-- ==============================================================================
-- ORÇAFÁCIL PLATFORM — MIGRAÇÃO INICIAL (00001_initial_schema.sql)
-- Multi-tenancy, RLS, Perfis, Organizações, Módulos, Clientes e Orçamentos
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS DE DOMÍNIO
DO $$ BEGIN
  CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE module_code AS ENUM ('orcafacil', 'agendapro', 'estoqueleve');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE module_grant_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. FUNÇÃO UTILITÁRIA PARA updated_at AUTOMÁTICO
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. TABELA PROFILES (extensão do auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. TABELA ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. TABELA ORGANIZATION_MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. TABELA MODULES (Catálogo global da plataforma)
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code module_code NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_globally_available BOOLEAN NOT NULL DEFAULT true
);

-- 8. TABELA ORGANIZATION_MODULES (Concessão de módulos para organizações)
CREATE TABLE IF NOT EXISTS public.organization_modules (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE RESTRICT,
  status module_grant_status NOT NULL DEFAULT 'active',
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, module_id)
);

CREATE TRIGGER trg_org_modules_updated_at
  BEFORE UPDATE ON public.organization_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. TABELA SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  external_customer_id TEXT,
  external_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. TABELA CUSTOMERS (Clientes da organização)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Chave única composta para garantir integridade multi-tenant em FKs filhas
  CONSTRAINT uq_customers_org_id UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(organization_id);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. TABELA QUOTES (Orçamentos do módulo OrçaFácil)
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  quote_number TEXT NOT NULL DEFAULT '',
  status quote_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garante que o cliente pertence EXATAMENTE à mesma organização do orçamento
  CONSTRAINT fk_quote_customer_org FOREIGN KEY (organization_id, customer_id)
    REFERENCES public.customers(organization_id, id) ON DELETE RESTRICT,
  -- Chave única composta para garantir integridade em quote_items
  CONSTRAINT uq_quotes_org_id UNIQUE (organization_id, id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_org ON public.quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(customer_id);

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. TABELA QUOTE_ITEMS (Itens do orçamento)
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 1),
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0000 CHECK (quantity > 0),
  unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_price >= 0),
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Garante que o item referencia um orçamento da mesma organização
  CONSTRAINT fk_quote_item_quote_org FOREIGN KEY (organization_id, quote_id)
    REFERENCES public.quotes(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_org ON public.quote_items(organization_id);

CREATE TRIGGER trg_quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 13. FUNÇÕES SEGURAS DE CONTROLE DE ACESSO (SECURITY DEFINER)
-- ==============================================================================

-- Função para consultar o papel do usuário na organização
CREATE OR REPLACE FUNCTION public.get_user_organization_role(org_id UUID, uid UUID)
RETURNS organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.organization_members
  WHERE organization_id = org_id AND user_id = uid
  LIMIT 1;
$$;

-- Função atômica e segura para criar uma organização com seu proprietário e liberar o OrçaFácil
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  owner_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  orcafacil_mod_id UUID;
BEGIN
  -- Impede que um usuário crie uma organização em nome de outro
  IF auth.uid() IS NULL OR auth.uid() <> owner_user_id THEN
    RAISE EXCEPTION 'Não autorizado a criar organização para outro usuário';
  END IF;

  -- 1. Cria a organização
  INSERT INTO public.organizations (name, slug)
  VALUES (trim(org_name), trim(lower(org_slug)))
  RETURNING id INTO new_org_id;

  -- 2. Adiciona o usuário criador como OWNER
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, owner_user_id, 'owner');

  -- 3. Concede o módulo OrçaFácil por padrão
  SELECT id INTO orcafacil_mod_id FROM public.modules WHERE code = 'orcafacil' LIMIT 1;
  IF orcafacil_mod_id IS NOT NULL THEN
    INSERT INTO public.organization_modules (organization_id, module_id, status)
    VALUES (new_org_id, orcafacil_mod_id, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Cria assinatura gratuita inicial
  INSERT INTO public.subscriptions (organization_id, plan_id, status)
  VALUES (new_org_id, 'free', 'active');

  RETURN new_org_id;
END;
$$;

-- ==============================================================================
-- 14. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- Isolamento multi-tenant garantido no banco de dados
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- --- PROFILES ---
CREATE POLICY "Usuários podem ver seus próprios perfis"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- --- ORGANIZATIONS ---
CREATE POLICY "Membros podem ver suas organizações"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners e Admins podem atualizar a organização"
  ON public.organizations FOR UPDATE
  USING (
    public.get_user_organization_role(id, auth.uid()) IN ('owner', 'admin')
  );

-- --- ORGANIZATION_MEMBERS ---
CREATE POLICY "Membros podem listar colegas da mesma organização"
  ON public.organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Apenas owners e admins podem gerenciar membros"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Apenas owners podem alterar papéis"
  ON public.organization_members FOR UPDATE
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) = 'owner'
  );

CREATE POLICY "Owners podem remover membros ou usuário pode sair"
  ON public.organization_members FOR DELETE
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) = 'owner'
    OR user_id = auth.uid()
  );

-- --- MODULES ---
CREATE POLICY "Todos autenticados podem ver módulos globais"
  ON public.modules FOR SELECT
  TO authenticated
  USING (true);

-- --- ORGANIZATION_MODULES ---
CREATE POLICY "Membros podem ver os módulos concedidos à sua organização"
  ON public.organization_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_modules.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- --- SUBSCRIPTIONS ---
CREATE POLICY "Membros podem ver a assinatura da sua organização"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = subscriptions.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- --- CUSTOMERS ---
CREATE POLICY "Membros podem visualizar clientes de sua organização"
  ON public.customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = customers.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem cadastrar clientes em sua organização"
  ON public.customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = customers.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar clientes de sua organização"
  ON public.customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = customers.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners e admins podem excluir clientes"
  ON public.customers FOR DELETE
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- --- QUOTES ---
CREATE POLICY "Membros podem ver orçamentos da sua organização"
  ON public.quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quotes.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem criar orçamentos na sua organização"
  ON public.quotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quotes.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar orçamentos da sua organização"
  ON public.quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quotes.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners e admins podem excluir orçamentos"
  ON public.quotes FOR DELETE
  USING (
    public.get_user_organization_role(organization_id, auth.uid()) IN ('owner', 'admin')
  );

-- --- QUOTE_ITEMS ---
CREATE POLICY "Membros podem ver itens de orçamentos de sua organização"
  ON public.quote_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quote_items.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem inserir itens em orçamentos de sua organização"
  ON public.quote_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quote_items.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar itens de orçamentos de sua organização"
  ON public.quote_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quote_items.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem excluir itens de orçamentos de sua organização"
  ON public.quote_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = quote_items.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- 15. DADOS INICIAIS (SEED) - CATÁLOGO DE MÓDULOS
-- ==============================================================================
INSERT INTO public.modules (code, name, is_globally_available)
VALUES
  ('orcafacil', 'OrçaFácil', true),
  ('agendapro', 'AgendaPro', false),
  ('estoqueleve', 'EstoqueLeve', false)
ON CONFLICT (code) DO NOTHING;

