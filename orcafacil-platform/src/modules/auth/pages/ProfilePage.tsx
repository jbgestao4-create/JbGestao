import { useState } from 'react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { authService } from '../services/auth.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import type { FontSizePreference } from '../context/AuthContext'

const FONT_SIZE_OPTIONS: { value: FontSizePreference; label: string; sample: string }[] = [
  { value: 'small', label: 'Pequena', sample: 'A' },
  { value: 'medium', label: 'Padrão', sample: 'A' },
  { value: 'large', label: 'Grande', sample: 'A' },
]

export function ProfilePage() {
  const { user, profile, fontSizePreference, setFontSizePreference } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    const res = await authService.updatePassword(newPassword)

    if (res.success) {
      setMessage('Senha atualizada com sucesso!')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setError(res.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-gray-500">Gerencie suas informações de acesso e credenciais</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Dados da Conta</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="block text-xs text-gray-500">Nome de Exibição</span>
            <span className="text-sm font-medium text-gray-900">
              {profile?.displayName || 'Não informado'}
            </span>
          </div>
          <div>
            <span className="block text-xs text-gray-500">E-mail de Acesso</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Preferências de Exibição</h2>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="text-sm font-medium text-gray-800">Tamanho da fonte</legend>
            <p className="mt-1 text-xs text-gray-500">
              Ajuste o tamanho dos textos da plataforma. A alteração é aplicada imediatamente.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Tamanho da fonte">
              {FONT_SIZE_OPTIONS.map((option) => {
                const isSelected = fontSizePreference === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setFontSizePreference(option.value)}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        option.value === 'small'
                          ? 'text-xs'
                          : option.value === 'large'
                            ? 'text-lg'
                            : 'text-base'
                      }
                    >
                      {option.sample}
                    </span>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-900">Alterar Senha</h2>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg">{message}</div>
          )}

          <form onSubmit={(e) => void handleUpdatePassword(e)} className="space-y-4">
            <Input
              label="Nova Senha"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirmar Nova Senha"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" isLoading={isLoading}>
              Salvar Nova Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
