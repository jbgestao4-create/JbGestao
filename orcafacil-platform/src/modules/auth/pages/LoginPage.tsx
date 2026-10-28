import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calculator,
  ChartNoAxesCombined,
  Check,
  CircleDollarSign,
  FileText,
  MessageCircle,
  ReceiptText,
  ShoppingCart,
} from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { BrandLogo } from '@shared/components/BrandLogo'

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
    <main className="min-h-screen bg-[#F8FAFC] lg:flex">
      <section className="relative hidden min-h-screen w-1/2 overflow-hidden bg-[#0F172A] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-12 xl:px-20">
        <div className="absolute -right-36 -top-32 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="absolute -right-20 -top-16 h-[22rem] w-[22rem] rounded-full border border-white/10" />

        <div className="relative">
          <BrandLogo dark />

          <div className="mt-16 max-w-lg">
            <p className="mb-5 text-sm font-semibold uppercase text-blue-300">Gestão empresarial</p>
            <h1 className="text-4xl font-semibold leading-tight">
              Gestão inteligente para o seu negócio.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
              Tenha mais clareza sobre a operação e tome decisões com confiança, em um só lugar.
            </p>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4">
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <CircleDollarSign aria-hidden="true" className="h-5 w-5" />
              </span>
              Controle Financeiro
            </li>
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <FileText aria-hidden="true" className="h-5 w-5" />
              </span>
              Orçamentos
            </li>
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ShoppingCart aria-hidden="true" className="h-5 w-5" />
              </span>
              Gestão de Vendas
            </li>
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ReceiptText aria-hidden="true" className="h-5 w-5" />
              </span>
              Nota Fiscal Eletrônica
            </li>
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <ChartNoAxesCombined aria-hidden="true" className="h-5 w-5" />
              </span>
              Relatórios em Tempo Real
            </li>
            <li className="flex items-center gap-4 text-sm font-medium text-slate-200">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300">
                <Calculator aria-hidden="true" className="h-5 w-5" />
              </span>
              Controle de Caixa
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="h-5 w-5 text-emerald-500" />
              Sem taxa de implantação
            </span>
            <span className="inline-flex items-center gap-2">
              <Check aria-hidden="true" className="h-5 w-5 text-emerald-500" />
              Sem taxa de cancelamento
            </span>
          </div>
          <div className="mt-6 max-w-md rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
            <p className="text-sm font-semibold text-white">2 meses grátis para sua empresa</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Clientes podem solicitar 2 meses grátis de utilização.
            </p>
            <a
              href="https://wa.me/5531986848490?text=Ol%C3%A1%21%20Gostaria%20de%20solicitar%202%20meses%20gr%C3%A1tis%20de%20utiliza%C3%A7%C3%A3o."
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Fale pelo WhatsApp
            </a>
          </div>
        </div>

        <p className="relative text-xs text-slate-400">JB Software de Gestão</p>
      </section>

      <section className="flex min-h-screen w-full flex-col items-center bg-[#F8FAFC] px-5 py-8 sm:px-8 lg:w-1/2 lg:px-12">
        <div className="flex w-full flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[440px]">
            <header className="mb-8 text-center">
              <BrandLogo size="lg" showName={false} className="mx-auto mb-6 lg:hidden" />
              <h2 className="text-3xl font-semibold text-slate-900">Acesse sua conta</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                JB Software de Gestão — Potencialize a administração da sua empresa
              </p>
            </header>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
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
                  placeholder="Digite sua senha"
                  required
                />

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-[#2563EB] hover:text-blue-700"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-[#2563EB] text-sm font-semibold hover:bg-blue-700"
                  isLoading={isLoading}
                >
                  Entrar
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Ainda não tem uma conta?{' '}
                <Link to="/register" className="font-semibold text-[#2563EB] hover:text-blue-700">
                  Cadastre-se gratuitamente
                </Link>
              </p>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Acesso seguro à sua plataforma de gestão.
            </p>
          </div>
        </div>

        <footer className="w-full max-w-[600px] pt-6 text-center text-xs leading-5 text-slate-500">
          <span>© 2026 JB Software de Gestão. Todos os direitos reservados.</span>
          <span className="mx-2 hidden sm:inline">|</span>
          <span className="block sm:inline">Termos de Uso</span>
          <span className="mx-2 hidden sm:inline">|</span>
          <span className="block sm:inline">Privacidade</span>
        </footer>
      </section>
    </main>
  )
}
