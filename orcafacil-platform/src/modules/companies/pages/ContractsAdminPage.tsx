import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, FileSignature, ShieldCheck } from 'lucide-react'
import { useAuth } from '@modules/auth/context/AuthContext'
import { isSystemOwner } from '@shared/utils/system-owner'
import { Button } from '@shared/components/ui/Button'
import {
  companyManagementService,
  type ManagedCompany,
} from '../services/company-management.service'
import { ContractsManagementSection } from '../components/ContractsManagementSection'

export function ContractsAdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillCompanyId = searchParams.get('companyId')

  const [companies, setCompanies] = useState<ManagedCompany[]>([])

  useEffect(() => {
    const loadCompanies = async () => {
      const res = await companyManagementService.listAll()
      if (res.success && res.data) {
        setCompanies(res.data)
      }
    }
    void loadCompanies()
  }, [])

  const prefillCompany = useMemo(() => {
    if (!prefillCompanyId || companies.length === 0) return null
    return companies.find((c) => c.id === prefillCompanyId) || null
  }, [prefillCompanyId, companies])

  if (!isSystemOwner(user)) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Acesso Restrito ao Desenvolvedor</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          O módulo de Gerar Contratos de Aluguel de Software é restrito exclusivamente ao desenvolvedor e proprietário da plataforma.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Navegação / Breadcrumb voltando para Configurações de Desenvolvedor */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigate('/admin/developer-settings')}
            className="gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Configurações de Desenvolvedor
          </Button>

          <span className="text-xs text-slate-400">/</span>

          <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileSignature className="h-3.5 w-3.5" />
            Gerar Contratos
          </span>
        </div>

        <Link
          to="/admin/companies"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-medium"
        >
          Ver Empresas Cadastradas →
        </Link>
      </div>

      {/* Seção Principal de Contratos */}
      <ContractsManagementSection
        existingCompanies={companies}
        prefillCompanyForNewContract={prefillCompany}
      />
    </div>
  )
}
