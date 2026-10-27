import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const res = await signIn({ email, password })

    if (res.success) {
      navigate('/')
    } else {
      setError(res.error)
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 shadow-md shadow-blue-500/20">
          OF
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Acesse sua conta</h2>
        <p className="mt-1 text-sm text-gray-500">
          OrçaFácil Platform — Gestão modular para autônomos e pequenos negócios
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />

            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-blue-600 hover:text-blue-500"
              >
                Esqueceu a senha?
              </Link>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Não tem uma conta?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500">
              Cadastre-se gratuitamente
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
