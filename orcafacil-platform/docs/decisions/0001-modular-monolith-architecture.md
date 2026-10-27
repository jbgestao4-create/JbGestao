# ADR 0001: Adoção de Arquitetura Monolítica Modular

- **Status:** Aceito
- **Data:** 2026-10-27

## Contexto
A plataforma OrçaFácil precisa atender a múltiplos módulos comerciais independentes (OrçaFácil, AgendaPro, EstoqueLeve), compartilhando autenticação, organizações e base de clientes, sem incorrer na sobrecarga operacional prematura de microsserviços.

## Decisão
Adotar um **Monólito Modular** em React/TypeScript com Supabase como backend unificado. Os módulos residem no mesmo repositório sob `src/modules/`, comunicando-se unicamente através de serviços públicos e contratos compartilhados em `src/shared/`.

## Consequências
- **Positivas:** Simplicidade de deploy em um único bundle estático (Cloudflare Pages / Vercel), sem necessidade de orquestração distribuída ou mensageria complexa; type-safety ponta a ponta.
- **Limitações:** Requer disciplina estrita de importação entre módulos para evitar acoplamento indevido.

