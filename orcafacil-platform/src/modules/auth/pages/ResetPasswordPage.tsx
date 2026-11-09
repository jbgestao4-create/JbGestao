import { useState, useEffect, type SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authService } from '../services/auth.service'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { BrandLogo } from '@shared/components/BrandLogo'
import { validatePasswordStrength } from '@shared/utils/password-validator'
import { supabase } from '@app/config/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')

    // Verifica se há sessão ativa da recuperação de senha
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      } else {
        // Aguarda possível evento de auth por hash de link de recuperação
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || session) {
            setReady(true)
          }
        })
        setTimeout(() => setReady(true), 1500)
        return () => subscription.unsubscribe()
      }
    })
  }, [])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      setError(
        'A senha deve conter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula, um número e um caractere especial.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    setIsLoading(true)
    const result = await authService.updatePassword(newPassword)
    setIsLoading(false)

    if (result.success) {
      setIsSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 4000)
    } else {
      setError(result.error || 'Não foi possível redefinir sua senha. O link pode ter expirado.')
    }
  }

  const validation = validatePasswordStrength(newPassword)
  const requirements = [
    { label: 'Mínimo de 8 caracteres', ok: validation.hasMinLength },
    { label: 'Pelo menos uma letra maiúscula (A-Z)', ok: validation.hasUpperCase },
    { label: 'Pelo menos uma letra minúscula (a-z)', ok: validation.hasLowerCase },
    { label: 'Pelo menos um número (0-9)', ok: validation.hasNumber },
    { label: 'Pelo menos um caractere especial (!@#$%...)', ok: validation.hasSpecialChar },
  ]

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="mt-2 text-xs text-slate-500">Verificando link de recuperação...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo size="lg" className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Redefinir Senha</h2>
        <p className="mt-1 text-sm text-gray-500">
          Crie uma nova senha segura para acessar sua conta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-2xl sm:px-10">
          {isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Senha redefinida com sucesso!</h3>
              <p className="text-sm text-gray-600">
                Sua senha foi atualizada. Você será redirecionado para a tela de login em alguns segundos...
              </p>
              <Button onClick={() => navigate('/login')} className="w-full">
                Ir para o login agora
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Nova Senha"
                type="password"
                placeholder="Ex: SenhaForte@2026"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-slate-700">Requisitos obrigatórios:</p>
                <div className="space-y-1 text-[11px]">
                  {requirements.map((req, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 ${
                        req.ok ? 'text-emerald-600 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {req.ok ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Input
                label="Confirmar Nova Senha"
                type="password"
                placeholder="Digite novamente a nova senha"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                isLoading={isLoading}
                disabled={!validation.isValid || !confirmPassword}
                className="w-full flex items-center justify-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Salvar Nova Senha
              </Button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-semibold text-blue-600 hover:underline">
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
