import { useEffect, useState, useRef, type SyntheticEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { validatePasswordStrength } from '@shared/utils/password-validator'
import {
  emailPasswordResetService,
  type RequestEmailResetResult,
} from '../services/email-password-reset.service'

type Step = 'email' | 'code' | 'new-password' | 'success'

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dados do e-mail ao solicitar código
  const [resetData, setResetData] = useState<RequestEmailResetResult | null>(null)

  // Código OTP recebido por e-mail (suporta 6 a 8 dígitos)
  const [otpCode, setOtpCode] = useState('')
  const otpInputRef = useRef<HTMLInputElement>(null)

  // Nova senha e confirmação
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
  }, [])

  // Auto-foco no input ao ir para o passo 'code'
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => {
        otpInputRef.current?.focus()
      }, 150)
    }
  }, [step])

  // Passo 1: Solicitar envio do código para o e-mail
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setIsLoading(true)

    const res = await emailPasswordResetService.requestResetCode(email)

    setIsLoading(false)

    if (!res.success) {
      setError(res.error)
      return
    }

    setResetData(res.data)
    setOtpCode('')
    setStep('code')
  }

  // Passo 2: Validar o código recebido no e-mail
  const handleVerifyCode = async (e?: SyntheticEvent) => {
    if (e) e.preventDefault()
    setError(null)

    const cleanCode = otpCode.replace(/\s/g, '').trim()
    if (cleanCode.length < 6) {
      setError('Digite o código de verificação recebido no seu e-mail (mínimo de 6 dígitos).')
      return
    }

    setIsLoading(true)

    const res = await emailPasswordResetService.verifyResetCode(email, cleanCode)

    setIsLoading(false)

    if (!res.success) {
      setError(res.error)
      return
    }

    setStep('new-password')
  }

  // Passo 3: Salvar a nova senha
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem. Digite a mesma senha nos dois campos.')
      return
    }

    const validation = validatePasswordStrength(newPassword)
    if (!validation.isValid) {
      setError(validation.errors[0])
      return
    }

    setIsLoading(true)

    const res = await emailPasswordResetService.completePasswordReset(newPassword)

    setIsLoading(false)

    if (!res.success) {
      setError(res.error)
      return
    }

    setStep('success')
  }

  const passwordValidation = validatePasswordStrength(newPassword)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* CABEÇALHO */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <img
            src="/controlesoft-logo.png"
            alt="ControleSoft"
            className="h-16 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              const fallback = document.getElementById('forgot-pw-logo-fallback')
              if (fallback) fallback.style.display = 'inline-block'
            }}
          />
          <span
            id="forgot-pw-logo-fallback"
            style={{ display: 'none' }}
            className="text-2xl font-black text-blue-900 tracking-tight"
          >
            Controle<span className="text-blue-600">Soft</span>
          </span>
        </div>

        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Recuperação de Senha
        </h1>
        <p className="mt-1.5 text-xs text-slate-600">
          Redefina seu acesso com confirmação rápida e segura via código por e-mail.
        </p>

        {/* INDICADOR DE PASSOS */}
        {step !== 'success' && (
          <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3 text-xs font-semibold">
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition ${
                step === 'email'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                1
              </span>
              E-mail
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition ${
                step === 'code'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step === 'new-password'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200/80 text-slate-500'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                2
              </span>
              Código (E-mail)
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition ${
                step === 'new-password'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-200/80 text-slate-500'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                3
              </span>
              Nova Senha
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
          {/* MENSAGEM DE ERRO GERAL */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* PASSO 1: INFORMAR E-MAIL */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  E-mail cadastrado no sistema *
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Enviaremos um código com 6 dígitos para o e-mail cadastrado.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2"
                isLoading={isLoading}
              >
                <Mail className="w-4 h-4" />
                <span>Enviar Código para o E-mail</span>
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition"
                >
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}

          {/* PASSO 2: DIGITAR OS 6 DÍGITOS RECEBIDOS POR E-MAIL */}
          {step === 'code' && (
            <div className="space-y-6">
              {/* CARD DE E-MAIL ENVIADO */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      Código enviado para seu e-mail!
                    </h3>
                    <p className="text-xs text-blue-800 mt-0.5">
                      Enviado para:{' '}
                      <strong className="font-mono font-bold text-blue-950">
                        {resetData?.maskedEmail || email}
                      </strong>
                    </p>
                    <p className="text-[11px] text-blue-700 mt-1">
                      Verifique sua caixa de entrada e também a pasta de spam.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between text-[11px] text-blue-800">
                  <span>Não recebeu o código?</span>
                  <button
                    type="button"
                    onClick={() => void handleRequestCode()}
                    className="font-bold text-blue-900 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reenviar agora
                  </button>
                </div>
              </div>

              {/* INPUT DO CÓDIGO DE CONFIRMAÇÃO */}
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div>
                  <label className="block text-center text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                    Código de Confirmação (recebido no e-mail):
                  </label>

                  <div className="relative max-w-[280px] mx-auto">
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8)
                        setOtpCode(val)
                        setError(null)
                      }}
                      placeholder="000000"
                      className="w-full h-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-extrabold tracking-[0.25em] rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 bg-white text-slate-900 shadow-2xs transition"
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Digite ou cole o código recebido no seu e-mail (6 a 8 dígitos).
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2"
                    isLoading={isLoading}
                    disabled={otpCode.replace(/\s/g, '').length < 6}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Validar Código e Continuar</span>
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('email')
                      setError(null)
                    }}
                    className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 transition"
                  >
                    Digitar outro e-mail
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PASSO 3: DEFINIR NOVA SENHA */}
          {step === 'new-password' && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-700 font-semibold mb-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  Requisitos para a nova senha:
                </p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        newPassword.length >= 8
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>Mínimo de 8 caracteres</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        /[A-Z]/.test(newPassword)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>Pelo menos uma letra maiúscula</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        /[a-z]/.test(newPassword)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>Pelo menos uma letra minúscula</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        /[0-9]/.test(newPassword)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>Pelo menos um número</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        /[^A-Za-z0-9]/.test(newPassword)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>Pelo menos um caractere especial (!@#$%...)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nova Senha *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirmar Nova Senha *
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs flex items-center justify-center gap-2"
                isLoading={isLoading}
                disabled={!passwordValidation.isValid || newPassword !== confirmPassword}
              >
                <KeyRound className="w-4 h-4" />
                <span>Salvar Nova Senha</span>
              </Button>
            </form>
          )}

          {/* PASSO 4: SUCESSO */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Senha alterada com sucesso!
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Sua conta foi atualizada. Você já pode acessar a plataforma utilizando sua nova senha.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition"
                >
                  <span>Acessar Minha Conta</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
