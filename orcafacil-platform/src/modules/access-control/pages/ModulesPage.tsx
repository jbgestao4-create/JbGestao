import { useModuleAccess } from '../context/ModuleAccessContext'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Calendar, Package, CheckCircle2, Clock } from 'lucide-react'

export function ModulesPage() {
  const { allModules, canAccess } = useModuleAccess()

  const getModuleIcon = (code: string) => {
    switch (code) {
      case 'orcafacil':
        return <FileSpreadsheet className="w-6 h-6 text-blue-600" />
      case 'agendapro':
        return <Calendar className="w-6 h-6 text-amber-600" />
      case 'estoqueleve':
        return <Package className="w-6 h-6 text-emerald-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Catálogo de Módulos</h1>
        <p className="text-sm text-gray-500">
          Ferramentas modulares independentes integradas à sua organização
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allModules.map((mod) => {
          const isActivated = canAccess(mod.code)

          return (
            <Card key={mod.code} className="flex flex-col justify-between">
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {getModuleIcon(mod.code)}
                  </div>
                  <div>
                    {isActivated ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </Badge>
                    ) : mod.status === 'coming_soon' ? (
                      <Badge variant="warning" className="gap-1">
                        <Clock className="w-3 h-3" /> Em Breve
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1">
                        Planejado
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">{mod.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{mod.description}</p>
                </div>
              </CardContent>

              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                {isActivated ? (
                  <Link to="/orcafacil/quotes" className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      Abrir Módulo
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full cursor-not-allowed"
                    disabled
                  >
                    Indisponível nesta versão
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
