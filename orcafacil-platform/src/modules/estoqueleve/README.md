# Módulo EstoqueLeve (Expansão Futura)

Este módulo está planejado para disponibilizar controle de estoques, movimentações de entrada/saída, insumos para serviços e alertas de reposição.

## Estado do Módulo

- **Status:** Planejado / Em concepção
- **Disponibilidade Global:** `false` (Indisponível como produto funcional nesta etapa)

## Contratos de Integração Compartilhada

1. **Autenticação e Multi-Tenancy:**
   - O EstoqueLeve **NÃO** deve implementar autenticação própria.
   - Deve consumir o contexto `useOrganization()` da plataforma.
   - Toda entidade interna (ex: `products`, `stock_movements`) pertencerá à organização e terá RLS ativada.
2. **Integração com Orçamentos (OrçaFácil):**
   - Não deve consultar tabelas internas do OrçaFácil diretamente.
   - A integração futura para baixa de materiais a partir de propostas aprovadas deve ocorrer via contrato de serviço ou eventos de domínio.
3. **Controle de Acesso:**
   - O acesso deve ser verificado centralmente via `useModuleAccess().canAccess('estoqueleve')`.
   - Rotas devem ser protegidas por `<RequireModule moduleCode="estoqueleve">`.
