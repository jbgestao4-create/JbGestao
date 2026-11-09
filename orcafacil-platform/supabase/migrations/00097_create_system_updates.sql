-- Migration 00097: Tabela de Registro de Atualizações do Sistema (Changelog / Histórico de Versões)

CREATE TABLE IF NOT EXISTS public.system_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'feature', -- 'feature', 'improvement', 'bugfix', 'security', 'maintenance'
  author_name TEXT NOT NULL,
  author_email TEXT,
  modules TEXT[],
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_updates_performed
  ON public.system_updates (performed_at DESC);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ler atualizacoes do sistema" ON public.system_updates;
CREATE POLICY "Todos podem ler atualizacoes do sistema"
  ON public.system_updates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Proprietarios gerenciam atualizacoes do sistema" ON public.system_updates;
CREATE POLICY "Proprietarios gerenciam atualizacoes do sistema"
  ON public.system_updates FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Inserir registros iniciais do histórico de desenvolvimento
INSERT INTO public.system_updates (version, title, description, type, author_name, author_email, modules, performed_at)
VALUES
  (
    'v2.4.0',
    'Configurações de Desenvolvedor, Modo de Manutenção e Notificações',
    'Criação do módulo exclusivo de Configurações de Desenvolvedor, modo de manutenção emergencial em tela cheia com bloqueio para clientes, notificações direcionadas a organizações/usuários e visualizador de último acesso.',
    'feature',
    'Bryan Mendes',
    'bryanmendes968@gmail.com',
    ARRAY['Desenvolvedor', 'Segurança', 'Empresas'],
    NOW()
  ),
  (
    'v2.3.0',
    'Módulo de Agenda, Carrossel de Anúncios e Integrações',
    'Novo módulo de Agenda com horários, clientes e serviços integrados diretamente a Orçamentos, Ordens de Serviço e Vendas. Adicionado gerenciador de comunicados e banners na tela inicial.',
    'feature',
    'Bryan Mendes',
    'bryanmendes968@gmail.com',
    ARRAY['Agenda', 'Anúncios', 'Vendas', 'OS'],
    NOW() - INTERVAL '1 day'
  ),
  (
    'v2.2.0',
    'Contador de Tempo de Tela e Acompanhamento de Atividade',
    'Rastreamento em segundo plano do tempo de permanência e data/hora do último acesso de cada colaborador no sistema.',
    'improvement',
    'Bryan Mendes',
    'bryanmendes968@gmail.com',
    ARRAY['Organização', 'Usuários'],
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT DO NOTHING;
