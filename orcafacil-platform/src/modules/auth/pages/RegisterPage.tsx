import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'

export function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (password.length < 8) {
      setError('A senha deve conter no mínimo 8 caracteres.')
      return
    }

    setIsLoading(true)
    const res = await signUp({ email, password, displayName })

    if (res.success) {
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
        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-3 shadow-md shadow-blue-500/20">
          OF
        </div>
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
