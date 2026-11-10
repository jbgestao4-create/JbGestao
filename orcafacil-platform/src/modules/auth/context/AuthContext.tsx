import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authService, type SignInParams, type SignUpParams } from '../services/auth.service'
import type { ServiceResult, UserProfile } from '@shared/types/common'

export type FontSizePreference = 'small' | 'medium' | 'large'

const FONT_SIZE_STORAGE_PREFIX = 'jb-font-size:'
const FONT_SIZE_PIXELS: Record<FontSizePreference, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

function isFontSizePreference(value: string | null): value is FontSizePreference {
  return value === 'small' || value === 'medium' || value === 'large'
}

interface AuthContextType {
  user: User | null
  mustChangePassword: boolean
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  fontSizePreference: FontSizePreference
  setFontSizePreference: (preference: FontSizePreference) => void
  signIn: (params: SignInParams) => Promise<ServiceResult<{ user: User; session: Session }>>
  signUp: (
    params: SignUpParams,
  ) => Promise<ServiceResult<{ user: User | null; session: Session | null }>>
  signOut: () => Promise<ServiceResult<void>>
  refreshProfile: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fontSizePreference, setFontSizePreferenceState] = useState<FontSizePreference>('medium')

  const loadProfile = async (currentUser: User) => {
    const prof = await authService.getProfile(currentUser.id)
    if (prof) {
      prof.email = currentUser.email ?? ''
      setProfile(prof)
    } else {
      setProfile({
        id: currentUser.id,
        displayName: currentUser.user_metadata['display_name'] as string | null,
        avatarUrl: null,
        email: currentUser.email ?? '',
        createdAt: currentUser.created_at,
      })
    }
  }

  useEffect(() => {
    // 1. Carrega sessão inicial
    void authService.getSession().then(async (initialSession) => {
      if (initialSession) {
        const currentUser = await authService.getCurrentUser()
        if (currentUser) {
          setSession({ ...initialSession, user: currentUser })
          setUser(currentUser)
          await loadProfile(currentUser)
        } else {
          setSession(null)
          setUser(null)
        }
      } else {
        setSession(null)
        setUser(null)
      }
      setIsLoading(false)
    })

    // 2. Escuta mudanças na autenticação (evita recarregar perfil ou recriar referência de user em refresh de aba)
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (event, newSession) => {
      // Se o usuário clicou no link de redefinição de senha enviado por e-mail
      if (
        event === 'PASSWORD_RECOVERY' ||
        (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))
      ) {
        if (window.location.pathname !== '/reset-password') {
          window.location.href = '/reset-password' + window.location.hash
          return
        }
      }

      setSession(newSession)
      const nextUser = newSession?.user ?? null
      setUser((prevUser) => {
        if (
          prevUser?.id &&
          nextUser?.id &&
          prevUser.id === nextUser.id &&
          event !== 'TOKEN_REFRESHED' &&
          event !== 'USER_UPDATED'
        ) {
          return prevUser
        }
        return nextUser
      })
      if (!nextUser) {
        setProfile(null)
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        await loadProfile(nextUser)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setFontSizePreferenceState('medium')
      document.documentElement.style.removeProperty('font-size')
      return
    }

    const storedPreference = localStorage.getItem(`${FONT_SIZE_STORAGE_PREFIX}${user.id}`)
    const preference = isFontSizePreference(storedPreference) ? storedPreference : 'medium'

    setFontSizePreferenceState(preference)
    document.documentElement.style.fontSize = FONT_SIZE_PIXELS[preference]
  }, [user])

  const handleSetFontSizePreference = (preference: FontSizePreference) => {
    if (!user) return

    setFontSizePreferenceState(preference)
    localStorage.setItem(`${FONT_SIZE_STORAGE_PREFIX}${user.id}`, preference)
    document.documentElement.style.fontSize = FONT_SIZE_PIXELS[preference]
  }

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user)
    }
  }

  const refreshUser = async () => {
    const currentUser = await authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
    }
  }

  const handleSignIn = async (params: SignInParams) => {
    const res = await authService.signIn(params)
    if (res.success) {
      setUser(res.data.user)
      setSession(res.data.session)
      await loadProfile(res.data.user)
    }
    return res
  }

  const handleSignUp = async (params: SignUpParams) => {
    return authService.signUp(params)
  }

  const handleSignOut = async () => {
    const res = await authService.signOut()
    if (res.success) {
      setUser(null)
      setProfile(null)
      setSession(null)
    }
    return res
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        mustChangePassword: user?.app_metadata?.must_change_password === true,
        profile,
        session,
        isLoading,
        fontSizePreference,
        setFontSizePreference: handleSetFontSizePreference,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
