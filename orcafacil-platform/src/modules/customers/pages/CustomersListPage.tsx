import { useEffect, useState } from 'react'
import { useOrganization } from '@modules/organizations/context/OrganizationContext'
import { customerService, type Customer } from '../services/customer.service'
import { Card, CardContent } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Users, Plus, Phone, Mail, MapPin, Trash2 } from 'lucide-react'

export function CustomersListPage() {
  const { currentOrganization } = useOrganization()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadCustomers = async () => {
    if (!currentOrganization) return
    setIsLoading(true)
    const res = await customerService.list(currentOrganization.id)
    if (res.success) {
      setCustomers(res.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void loadCustomers()
  }, [currentOrganization])

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrganization) return

    if (name.trim().length < 2) {
      setFormError('O nome deve conter pelo menos 2 caracteres.')
      return
    }

    setIsSaving(true)
    setFormError('')

    const res = await customerService.create(currentOrganization.id, {
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    })

    if (res.success) {
      setIsModalOpen(false)
      setName('')
      setPhone('')
      setEmail('')
      setAddress('')
      await loadCustomers()
    } else {
      setFormError(res.error)
    }

    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!currentOrganization) return
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return

    const res = await customerService.delete(currentOrganization.id, id)
    if (res.success) {
      await loadCustomers()
    } else {
      alert(res.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">
            Base centralizada de clientes compartilhada entre os módulos da organização
          </p>
        </div>

        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Carregando clientes...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nenhum cliente cadastrado ainda.{' '}
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-blue-600 font-medium hover:underline cursor-pointer"
              >
                Cadastrar o primeiro
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 text-xs uppercase text-gray-400 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Nome</th>
                    <th className="px-6 py-3">Contato</th>
                    <th className="px-6 py-3">Endereço</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-6 py-4 space-y-1">
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Phone className="w-3.5 h-3.5 text-gray-400" /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Mail className="w-3.5 h-3.5 text-gray-400" /> {c.email}
                          </div>
                        )}
                        {!c.phone && !c.email && <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">
                        {c.address ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => void handleDelete(c.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cadastrar Cliente</h3>
            <p className="text-xs text-gray-500 mb-4">
              O cliente estará disponível para todos os módulos da organização.
            </p>

            <form onSubmit={(e) => void handleCreateCustomer(e)} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{formError}</div>
              )}

              <Input
                label="Nome do Cliente *"
                placeholder="Ex: Condomínio Solar das Flores"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Telefone / WhatsApp"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <Input
                label="E-mail"
                type="email"
                placeholder="contato@cliente.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="Endereço Completo"
                placeholder="Rua das Acácias, 123 - Centro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Salvar Cliente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
