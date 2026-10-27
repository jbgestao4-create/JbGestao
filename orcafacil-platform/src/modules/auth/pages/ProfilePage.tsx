import { useState } from 'react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { authService } from '../services/auth.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'

export function ProfilePage() {
  const { user, profile } = useAuth()
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
