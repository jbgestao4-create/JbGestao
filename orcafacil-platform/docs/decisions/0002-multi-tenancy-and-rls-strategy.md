# ADR 0002: Estratégia de Multi-Tenancy e Isolamento via RLS

- **Status:** Aceito
- **Data:** 2026-10-27

## Contexto
Como uma plataforma SaaS multi-tenant, o vazamento de dados comerciais entre organizações distintas é um risco inaceitável. O isolamento não pode depender apenas de filtros `WHERE` aplicados pelo cliente frontend.

## Decisão
Implementar Row Level Security (RLS) mandatória em todas as tabelas comerciais do PostgreSQL. Além disso, utilizar **chaves estrangeiras compostas** `(organization_id, id)` entre entidades pai e filho (ex: orçamentos e clientes) para que o próprio motor do banco recuse associações cruzadas no nível de integridade referencial.

## Consequências
- **Positivas:** Impossibilidade de vazamento horizontal ou IDOR mesmo em caso de manipulação de requisições HTTP; aplicação do princípio de menor privilégio no banco.
- **Limitações:** Índices adicionais necessários para suportar chaves estrangeiras compostas.

