import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await authService.requestPasswordReset(email)

    setIsLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Recuperar senha</h2>
        <p className="mt-1 text-sm text-gray-500">
          Informe seu e-mail cadastrado para receber o link de redefinição
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-2xl sm:px-10">
          {submitted ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-blue-50 text-blue-700 text-sm rounded-xl border border-blue-100">
                Se este e-mail estiver cadastrado na plataforma, você receberá em instantes as
                instruções para redefinir sua senha.
              </div>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  Voltar para o login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Enviar link de recuperação
              </Button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-gray-500 hover:text-gray-700">
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

