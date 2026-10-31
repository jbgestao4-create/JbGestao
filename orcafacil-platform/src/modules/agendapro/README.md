# Módulo AgendaPro (Expansão Futura)

Este módulo está planejado para disponibilizar recursos de agendamento de atendimentos, horários de profissionais e integração com os clientes da organização.

## Estado do Módulo

- **Status:** Planejado / Em concepção
- **Disponibilidade Global:** `false` (Indisponível como produto funcional nesta etapa)

## Contratos de Integração Compartilhada

1. **Autenticação e Multi-Tenancy:**
   - O AgendaPro **NÃO** deve implementar autenticação própria.
   - Deve consumir o contexto `useOrganization()` da plataforma.
   - Toda consulta no banco deve ser filtrada por `organization_id` e protegida por RLS.
2. **Compartilhamento de Clientes:**
   - Deve utilizar a tabela central `public.customers` através do serviço compartilhado `customerService`.
3. **Controle de Acesso:**
   - O acesso deve ser verificado centralmente via `useModuleAccess().canAccess('agendapro')`.
   - Rotas devem ser protegidas por `<RequireModule moduleCode="agendapro">`.
