import { useState, type SyntheticEvent } from 'react'
import { Check, X } from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { authService } from '../services/auth.service'
import { Card, CardContent, CardHeader } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import type { FontSizePreference } from '../context/AuthContext'
import { validatePasswordStrength } from '@shared/utils/password-validator'

function PasswordRequirementsChecklist({ password }: { password: string }) {
  const result = validatePasswordStrength(password)
  const items = [
    { label: 'Mínimo de 8 caracteres', ok: result.hasMinLength },
    { label: 'Pelo menos uma letra maiúscula (A-Z)', ok: result.hasUpperCase },
    { label: 'Pelo menos uma letra minúscula (a-z)', ok: result.hasLowerCase },
    { label: 'Pelo menos um número (0-9)', ok: result.hasNumber },
    { label: 'Pelo menos um caractere especial (!@#$%...)', ok: result.hasSpecialChar },
  ]

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs space-y-1.5">
      <p className="font-semibold text-slate-700 dark:text-slate-300">A senha deve conter:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-1.5 ${
              it.ok ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {it.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FONT_SIZE_OPTIONS: { value: FontSizePreference; label: string; sample: string }[] = [
  { value: 'small', label: 'Pequena', sample: 'A' },
  { value: 'medium', label: 'Padrão', sample: 'A' },
  { value: 'large', label: 'Grande', sample: 'A' },
]

export function ProfilePage() {
  const {
    user,
    profile,
    mustChangePassword,
    fontSizePreference,
    setFontSizePreference,
    refreshProfile,
    refreshUser,
  } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [isAvatarLoading, setIsAvatarLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdateAvatar = async () => {
    if (!user || !avatarFile) return

    setAvatarError('')
    setAvatarMessage('')
    setIsAvatarLoading(true)

    const result = await authService.updateAvatar(user.id, avatarFile)
    if (result.success) {
      await refreshProfile()
      setAvatarFile(null)
      setAvatarMessage('Foto do perfil atualizada com sucesso.')
    } else {
      setAvatarError(result.error)
    }

    setIsAvatarLoading(false)
  }

  const handleUpdatePassword = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      setError(
        'A senha deve ter no mínimo 8 caracteres, contendo pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial.'
      )
      return
    }

    if (mustChangePassword && (newPassword === '12345678' || newPassword === '00000000')) {
      setError('A nova senha não pode ser igual à senha temporária inicial.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    const res = mustChangePassword
      ? await authService.completeForcedPasswordChange(newPassword)
      : await authService.updatePassword(newPassword)

    if (res.success) {
      if (mustChangePassword) {
        await refreshUser()
      }
      setMessage('Senha atualizada com sucesso!')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setError(res.error)
    }

    setIsLoading(false)
  }

  if (mustChangePassword) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center">
        <Card className="w-full border-amber-300">
          <CardHeader>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-xl font-bold text-gray-900">Crie uma nova senha</h1>
              <p className="text-sm text-gray-600">
                Sua senha foi redefinida. Para continuar usando o sistema, substitua a senha
                temporária por uma senha pessoal com pelo menos 8 caracteres.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}
            <form
              onSubmit={(event) => {
                void handleUpdatePassword(event)
              }}
              className="space-y-4"
            >
              <Input
                label="Nova senha"
                type="password"
                placeholder="Ex: SenhaForte@2026"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                required
              />
              <PasswordRequirementsChecklist password={newPassword} />
              <Input
                label="Confirmar nova senha"
                type="password"
                placeholder="Digite novamente a nova senha"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                required
              />
              <Button type="submit" isLoading={isLoading} className="w-full">
                Salvar nova senha e continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
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
          <h2 className="text-sm font-semibold text-gray-900">Foto do Perfil</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xl font-bold text-blue-800">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={`Foto de ${profile.displayName || 'perfil'}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile?.displayName
                  ?.trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase() || 'U'
              )}
            </span>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Escolha uma imagem JPG, PNG ou WEBP de até 5 MB. Ela será exibida no avatar do seu
                perfil.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  label="Selecionar foto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="h-auto max-w-xs cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
                  onChange={(event) => {
                    setAvatarFile(event.currentTarget.files?.[0] ?? null)
                    setAvatarError('')
                    setAvatarMessage('')
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    void handleUpdateAvatar()
                  }}
                  disabled={!avatarFile}
                  isLoading={isAvatarLoading}
                >
                  Salvar foto
                </Button>
              </div>
              {avatarError && (
                <p role="alert" className="text-sm text-red-600">
                  {avatarError}
                </p>
              )}
              {avatarMessage && (
                <p role="status" className="text-sm text-green-700">
                  {avatarMessage}
                </p>
              )}
            </div>
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
                    onClick={() => {
                      setFontSizePreference(option.value)
                    }}
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

          <form
            onSubmit={(e) => {
              void handleUpdatePassword(e)
            }}
            className="space-y-4"
          >
            <Input
              label="Nova Senha"
              type="password"
              placeholder="Ex: SenhaForte@2026"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
              }}
              required
            />
            <PasswordRequirementsChecklist password={newPassword} />
            <Input
              label="Confirmar Nova Senha"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
              }}
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
