# Segurança e Row Level Security (RLS)

## 1. Princípios de Segurança Implementados

- **Menor Privilégio:** O frontend opera unicamente com a chave pública anônima (`anon key`). Nenhuma chave privilegiada (`service_role`) está exposta ou presente no bundle.
- **Fail Secure:** RLS está habilitada em todas as tabelas públicas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Por padrão, qualquer acesso não explicitamente permitido por uma política é bloqueado com erro 403 / conjunto vazio.
- **Isolamento Multi-Tenant Garantido no Banco:** Toda leitura, inserção, alteração e exclusão é validada contra o ID da organização à qual o usuário autenticado (`auth.uid()`) pertence.

---

## 2. Matriz de Autorização por Papel

| Operação | Membro Operacional (`member`) | Administrador (`admin`) | Proprietário (`owner`) |
|---|:---:|:---:|:---:|
| Ver dados da organização e módulos | ✅ | ✅ | ✅ |
| Criar e visualizar clientes | ✅ | ✅ | ✅ |
| Excluir clientes | ❌ | ✅ | ✅ |
| Criar e visualizar orçamentos | ✅ | ✅ | ✅ |
| Alterar status de orçamentos | ✅ | ✅ | ✅ |
| Excluir orçamentos | ❌ | ✅ | ✅ |
| Convidar novos membros | ❌ | ✅ | ✅ |
| Alterar papel de outros membros | ❌ | ❌ | ✅ |
| Editar dados cadastrais da empresa | ❌ | ✅ | ✅ |
| Excluir a organização | ❌ | ❌ | ✅ |
| Enviar uma sugestão | ✅ | ✅ | ✅ |
| Consultar e administrar sugestões da empresa | ❌ | ❌ | ✅ |

---

## 3. Políticas de RLS Detalhadas

### Funções Auxiliares Seguras
- `get_user_organization_role(org_id, uid)`: função `SECURITY DEFINER` com `search_path = public` estrito, evitando recursão infinita de políticas RLS ao consultar a tabela `organization_members`.

### Prevenção contra Modificação Indevida de Papéis
- Inserções diretas em `organization_members` pelo cliente exigem que o usuário autenticado já possua o papel de `owner` ou `admin` naquela organização.
- A função transacional `create_organization_with_owner(org_name, org_slug, owner_user_id)` verifica `IF auth.uid() <> owner_user_id THEN RAISE EXCEPTION` para impedir que um usuário crie uma empresa se passando por outro.

### Sugestões e feedback (migração `00079_feedback_suggestions.sql`)
- O envio exige autenticação e vínculo persistido em `organization_members`; usuário, nome, organização, status inicial e timestamps são definidos/validados no banco.
- `feedback_suggestions`, anexos, histórico e observações internas têm RLS. A consulta e a administração dependem de papel `owner` na organização do registro; administradores e membros não recebem acesso de leitura.
- As atualizações de sugestões só concedem permissão de coluna para `status`. O histórico de status é gravado por trigger, sem permissão de escrita direta.
- O bucket `feedback-attachments` é privado; aceita apenas imagens JPG, PNG e WEBP de até 5 MB. Uploads são vinculados a uma sugestão do próprio usuário e a leitura exige proprietário da empresa.
- A aplicação verifica a associação do proprietário para a navegação, mas autorização real permanece no Supabase, independentemente do frontend.
- A migração `00080_feedback_suggestion_reads.sql` registra visualizações por proprietário, empresa e sugestão. As RPCs de consulta/registro validam o papel no banco; membros e administradores não podem consultar nem modificar contagens de leitura.
- A tabela de sugestões é adicionada à publicação `supabase_realtime` quando disponível; a interface também atualiza a contagem ao voltar à janela e periodicamente.

---

## 4. Gestão de Segredos e Variáveis de Ambiente

- **`.env.local`:** Arquivo ignorado pelo Git (via `.gitignore`).
- **Validação de Startup:** [`src/app/config/env.ts`](file:///c:/Users/alexs/OneDrive/Documentos/ProjectX/orcafacil-platform/src/app/config/env.ts) confere a existência das chaves obrigatórias antes da renderização do React.
- **Sem Segredos em Produção:** O frontend não possui acesso a chaves mestras de banco de dados nem segredos de webhook.
