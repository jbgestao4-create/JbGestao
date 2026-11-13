import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { BrandLogo } from '@shared/components/BrandLogo'
import { termsAcceptanceService } from '@shared/services/terms-acceptance.service'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (password.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.')
      return
    }

    if (!acceptedTerms) {
      setError('Você deve ler e concordar com os Termos de Uso e a Política de Privacidade.')
      return
    }

    setIsLoading(true)
    const res = await signUp({ email, password, displayName })

    if (res.success) {
      void termsAcceptanceService.recordAcceptance(email, Boolean(res.data.session))
      if (res.data.session) {
        navigate('/')
      } else {
        setSuccessMsg(
          'Conta criada! Se o seu ambiente exige confirmação, verifique seu e-mail para ativar.',
        )
      }
    } else {
      setError(res.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo size="lg" className="mx-auto mb-3" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Crie sua conta</h2>
        <p className="mt-1 text-sm text-gray-500">
          Comece a gerenciar seus orçamentos e clientes de forma profissional
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
              {successMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              label="Seu Nome Completo"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: João da Silva"
              required
            />

            <Input
              label="E-mail profissional"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@exemplo.com"
              required
            />

            <Input
              label="Senha"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />

            <label className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-blue-600"
                required
              />
              <span className="leading-relaxed">
                Li e concordo com os{' '}
                <Link
                  to="/politica-de-privacidade?tab=terms"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link
                  to="/politica-de-privacidade"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Criar Conta Gratuita
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Já possui uma conta?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
