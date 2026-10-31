# Módulo EstoqueLeve (Expansão Futura)

O cadastro de produtos, unidades flexíveis, fornecedores, consulta e movimentação de saldos está disponível no módulo JB Software em `src/modules/inventory/`. O EstoqueLeve permanece reservado para uma futura experiência independente, sem duplicar esses fluxos.

## Estado do Módulo

- **Status:** Planejado / Em concepção
- **Disponibilidade Global:** `false` (Indisponível como produto funcional nesta etapa)

## Contratos de Integração Compartilhada

1. **Autenticação e Multi-Tenancy:**
   - O EstoqueLeve **NÃO** deve implementar autenticação própria.
   - Deve consumir o contexto `useOrganization()` da plataforma.
   - Toda entidade interna (ex: `products`, `stock_movements`) pertencerá à organização e terá RLS ativada.
2. **Integração com Orçamentos (JB Software):**
   - Não deve consultar tabelas internas do módulo JB Software diretamente.
   - A integração do estoque existente com orçamentos pertence ao módulo JB Software; o EstoqueLeve não deve duplicar essa integração.
3. **Controle de Acesso:**
   - O acesso deve ser verificado centralmente via `useModuleAccess().canAccess('estoqueleve')`.
   - Rotas devem ser protegidas por `<RequireModule moduleCode="estoqueleve">`.
