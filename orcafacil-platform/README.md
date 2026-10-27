# OrçaFácil Platform

Fundação técnica funcional da plataforma SaaS multi-tenant, modular e extensível voltada para profissionais autônomos, prestadores de serviços e pequenos negócios.

---

## 🚀 Stack Tecnológica

- **Frontend:** React 19, TypeScript (strict: true), Vite, Tailwind CSS v4, React Router v7.
- **Formulários e Validação:** React Hook Form, Zod.
- **Backend & Persistência:** Supabase (Auth, PostgreSQL, Row Level Security, Edge RPCs).
- **Testes & Qualidade:** Vitest, Testing Library, Prettier, TypeScript.
- **Deploy:** Preparado para Cloudflare Pages / Vercel.

---

## 📦 Estrutura de Módulos

```text
orcafacil-platform/
├── src/
│   ├── app/                    # Configurações globais, rotas e layouts
│   ├── modules/
│   │   ├── auth/               # Autenticação, perfis e credenciais
│   │   ├── organizations/      # Multi-tenancy, membros e papéis
│   │   ├── access-control/     # Entitlements e concessões de módulos
│   │   ├── dashboard/          # Visão geral e métricas da organização
│   │   ├── customers/          # Clientes compartilhados entre módulos
│   │   ├── orcafacil/          # Módulo funcional de orçamentos e propostas
│   │   ├── agendapro/          # Contrato de expansão futura (agendamentos)
│   │   └── estoqueleve/        # Contrato de expansão futura (estoque)
│   ├── shared/                 # Componentes UI, lib, utils monetários e validações
│   └── styles/                 # Estilos globais Tailwind CSS
├── supabase/
│   └── migrations/             # Migrações SQL versionadas com RLS e triggers
└── docs/                       # Documentação técnica e ADRs
```

---

## ⚙️ Pré-requisitos

- **Node.js:** v20+ (desenvolvido e testado em Node v24)
- **npm:** v10+
- **Conta Supabase:** Projeto criado em [supabase.com](https://supabase.com) (ou Supabase CLI local com Docker).

---

## 🛠️ Configuração e Execução Local

### 1. Clonar e Instalar Dependências
```bash
cd orcafacil-platform
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env.local`:
```bash
cp .env.example .env.local
```

Preencha com a URL e a chave anônima (`anon`) do seu projeto Supabase:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

### 3. Aplicar Migrações no Banco de Dados
Com a Supabase CLI conectada ao projeto:
```bash
npx supabase db push
```
*(Ou execute o script `supabase/migrations/00001_initial_schema.sql` no SQL Editor do Supabase).*

### 4. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no navegador em `http://localhost:5173`.

---

## 🧪 Testes Automatizados e Verificações

```bash
# Executar suíte de testes unitários
npm run test

# Verificação estática de tipos (TypeScript strict)
npm run typecheck

# Formatação e checagem de estilo
npm run format

# Build de produção otimizado
npm run build
```

---

## 📚 Documentação Técnica Adicional

- [Arquitetura Geral](docs/architecture.md)
- [Modelo de Dados e Banco](docs/database.md)
- [Segurança e Row Level Security (RLS)](docs/security.md)
- [Guia de Desenvolvimento e Novos Módulos](docs/development.md)
- [Decisões Arquiteturais (ADRs)](docs/decisions/)
