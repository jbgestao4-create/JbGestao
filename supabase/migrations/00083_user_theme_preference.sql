-- Adiciona a coluna theme_color na tabela public.profiles para personalização visual do sistema por usuário
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#2563eb';

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.profiles.theme_color IS 'Cor principal personalizada do sistema para a interface do usuário';

