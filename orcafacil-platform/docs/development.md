# Guia de Desenvolvimento

## 1. Padrões de Código e Convenções

- **TypeScript Estrito:** Todo código deve compilar sob `strict: true`. O uso de `any` ou type casting cego (`as Type`) sem validação prévia é estritamente evitado.
- **Idioma:** Documentação e comentários em **português brasileiro**; identificadores, tipos e funções em **inglês**.
- **Monetary Arithmetic:** Qualquer cálculo com valores monetários deve ser processado exclusivamente através das funções utilitárias em `src/shared/utils/monetary.ts`.
- **Validação de Fronteira:** Formulários e payloads externos devem ser validados via schemas Zod em `src/shared/validation/schemas.ts`.

---

## 2. Como Adicionar um Novo Módulo (Ex: AgendaPro)

A plataforma foi projetada para expansão estática sem quebra do núcleo compartilhado:

1. **Defina o contrato no Catálogo:**
   - Adicione os metadados do módulo em `src/modules/access-control/services/module-access.service.ts` no `PLATFORM_MODULES_CATALOG`.
2. **Crie a pasta do módulo:**
   - `src/modules/agendapro/` com subpastas `domain/`, `services/`, `pages/`.
3. **Consuma os serviços centrais:**
   - Use `useOrganization()` para obter o `currentOrganization.id`.
   - Use `customerService` para reaproveitar os clientes da organização.
4. **Proteja as Rotas:**
   - No arquivo `src/app/router/index.tsx`, envolva as páginas com:
     ```tsx
     <ProtectedRoute>
       <RequireModule moduleCode="agendapro">
         <AgendaProDashboardPage />
       </RequireModule>
     </ProtectedRoute>
     ```
5. **Crie as tabelas específicas com RLS:**
   - Nova migração SQL em `supabase/migrations/` vinculando tabelas a `organization_id` com políticas RLS.

---

## 3. Checklist Antes de Abrir Pull Request

Antes de enviar alterações para o repositório, execute a suíte de validação:

```bash
# 1. Executar testes unitários
npm run test

# 2. Verificação estática de tipos
npm run typecheck

# 3. Formatação
npm run format

# 4. Build de produção
npm run build
```

