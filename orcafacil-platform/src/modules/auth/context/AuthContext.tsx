import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authService, type SignInParams, type SignUpParams } from '../services/auth.service'
import type { ServiceResult, UserProfile } from '@shared/types/common'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  signIn: (params: SignInParams) => Promise<ServiceResult<{ user: User; session: Session }>>
  signUp: (
    params: SignUpParams,
  ) => Promise<ServiceResult<{ user: User | null; session: Session | null }>>
  signOut: () => Promise<ServiceResult<void>>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = async (currentUser: User) => {
    const prof = await authService.getProfile(currentUser.id)
    if (prof) {
      prof.email = currentUser.email ?? ''
      setProfile(prof)
    } else {
      setProfile({
        id: currentUser.id,
        displayName: currentUser.user_metadata['display_name'] as string | null,
        email: currentUser.email ?? '',
        createdAt: currentUser.created_at,
      })
    }
  }

  useEffect(() => {
    // 1. Carrega sessão inicial
    void authService.getSession().then(async (initialSession) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      if (initialSession?.user) {
        await loadProfile(initialSession.user)
      }
      setIsLoading(false)
    })

    // 2. Escuta mudanças na autenticação
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (newSession?.user) {
        await loadProfile(newSession.user)
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user)
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
        profile,
        session,
        isLoading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile,
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
