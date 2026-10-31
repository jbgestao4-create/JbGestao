# ADR 0003: Tratamento Rígido de Dados Monetários e Arredondamento

- **Status:** Aceito
- **Data:** 2026-10-27

## Contexto
O cálculo de valores monetários no JavaScript utilizando o tipo nativo `Number` (ponto flutuante IEEE 754 de 64 bits) sofre com erros de arredondamento inerentes à representação binária (ex: `0.1 + 0.2 = 0.30000000000000004`).

## Decisão
1. Persistir todos os campos financeiros como `NUMERIC(12, 2)` (ou `NUMERIC(12, 4)` para quantidades e preços unitários) no PostgreSQL.
2. Tratar valores monetários na aplicação como strings decimais manipuladas por funções utilitárias dedicadas (`src/shared/utils/monetary.ts`) com estratégia de arredondamento explícita `HALF_UP`.
3. Nunca confiar em totais calculados ou enviados pelo navegador; o serviço recalcula subtotal e total no momento da persistência.

## Consequências
- **Positivas:** Precisão contábil e fiscal absoluta; consistência em toda a suíte de testes.
- **Limitações:** Necessidade de formatação explícita para exibição visual.

