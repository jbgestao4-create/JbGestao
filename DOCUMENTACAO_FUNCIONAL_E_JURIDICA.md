# DOCUMENTAÇÃO FUNCIONAL, TÉCNICA E DE MATRIZ DE RESPONSABILIDADES JURÍDICAS
**Sistema:** ControleSoft / JB Gestão (Plataforma SaaS de Gestão Empresarial e Comercial)  
**Finalidade deste Documento:** Subsídio técnico-funcional completo para assessoria jurídica na elaboração dos **Termos e Condições de Uso**, **Contrato de Licenciamento de Software como Serviço (SaaS / SLA)** e **Política de Privacidade e Tratamento de Dados Pessoais (LGPD — Lei nº 13.709/2018)**.

---

## 1. VISÃO GERAL E NATUREZA JURÍDICA DO SISTEMA

### 1.1. O que é o Sistema
O **ControleSoft / JB Gestão** é uma plataforma web em nuvem (*Software as a Service* — SaaS), estruturada em arquitetura **Multi-Tenant** (múltiplas empresas independentes utilizando a mesma infraestrutura tecnológica, com isolamento lógico de dados por empresa/organização via *Row-Level Security* — RLS).

O software destina-se à **gestão operacional, comercial e administrativa interna** de micro, pequenas e médias empresas (comércios, prestadores de serviços e assistências técnicas), abrangendo controle de estoque, frente de caixa (PDV), orçamentos, ordens de serviço, cadastros de clientes/fornecedores, controle interno de caixa e relatórios gerenciais.

### 1.2. Enquadramento Jurídico Fundamental (Obrigação de Meio)
* **Ferramenta de Apoio Gerencial:** O software constitui uma **obrigação de meio** (disponibilização de ferramenta tecnológica de registro e cálculo), e **não uma obrigação de resultado** contábil, fiscal, financeiro ou comercial.
* **Autonomia dos Dados:** Toda e qualquer informação inserida, parametrizada, importada, alterada ou excluída no sistema (preços, custos, saldos de estoque, descontos, dados pessoais de terceiros, termos de garantia, baixas de caixa) é de **autoria e responsabilidade exclusiva da Empresa Licenciada (Contratante/Usuária)** e de seus usuários autorizados.
* **Não Substituição Profissional:** O software **não substitui** assessoria contábil, fiscal, jurídica ou instituição financeira/bancária.

---

## 2. ARQUITETURA DE PERMISSÕES, PAPÉIS E CONTROLE DE ACESSO (CRÍTICO)

O sistema possui um controle de acesso em múltiplas camadas. **Este é um dos pontos de maior relevância jurídica**, pois define quem responde pelos atos praticados dentro da conta empresarial.

### 2.1. Hierarquia de Usuários na Plataforma
1. **Proprietário do Sistema / SuperAdmin (`System Owner`):**
   * Administração global da plataforma SaaS.
   * Poderes: Cadastrar/ativar/inativar empresas clientes (`organizations`), definir planos de acesso (`Access Plans`), conceder ou revogar módulos contratados, configurar períodos de avaliação gratuita (*Trial*), publicar comunicados/notificações globais, ativar modo de manutenção programada e prestar suporte técnico.
2. **Proprietário / Administrador da Empresa Cliente (`owner` / `admin`):**
   * Representante legal ou gestor designado pela empresa contratante.
   * Poderes: Acesso irrestrito aos módulos contratados pela empresa; criação, edição e exclusão de contas de funcionários/membros (`organization_members`); definição de senhas iniciais; concessão e revogação individualizada de módulos e sub-recursos para cada funcionário; alteração dos dados cadastrais e identidade visual da empresa.
3. **Membro / Colaborador (`member`):**
   * Funcionário, vendedor, técnico ou operador de caixa vinculado à empresa contratante.
   * Poderes: Acesso **estritamente limitado** aos módulos (`MOD-01` a `MOD-11`), sub-funções e nível de visualização de estoque que lhe forem expressamente concedidos pelo Administrador da Empresa.

### 2.2. Granularidade de Permissões por Membro
O Administrador da Empresa pode habilitar ou bloquear individualmente para cada funcionário:
* **Acesso por Módulo e Sub-recurso:** Ex.: permitir que um vendedor acesse "Nova Venda" (`MOD-01_QUICK_SALE`), mas bloquear "Consultar Vendas" (`MOD-01_SEARCH`) ou "Gerenciamento do Caixa" (`MOD-05`).
* **Nível de Acesso ao Estoque (`InventoryAccessLevel`):**
  * `total`: Pode visualizar custos, cadastrar, editar e movimentar estoque;
  * `view`: Apenas consulta de saldo e preço de venda;
  * `none`: Sem acesso direto ao módulo de estoque.

### 2.3. Pontos de Atenção Jurídica em Permissões e Credenciais
> **Cláusulas Recomendadas para os Termos:**
> 1. **Responsabilidade por Prepostos (Art. 932, III do Código Civil):** A Empresa Contratante é integral e objetivamente responsável por todos os atos, lançamentos, descontos, sangrias de caixa, exclusões, exportações de dados e compartilhamentos realizados pelas contas de seus sócios, administradores, funcionários, terceirizados ou prepostos.
> 2. **Guarda de Credenciais e Desligamento de Funcionários:** O login e senha são pessoais e intransferíveis. É dever exclusivo do Administrador da Empresa **revogar ou excluir imediatamente** o acesso de funcionários demitidos, afastados ou que mudarem de função. A fornecedora do software não possui ingerência sobre o quadro de funcionários da Contratante.
> 3. **Compartilhamento Indevido de Senhas:** Caso a Empresa Contratante compartilhe uma mesma conta de nível `admin` entre múltiplos operadores, assumirá integralmente o risco pela impossibilidade de individualização da autoria nos logs de auditoria (vendedor/operador).

---

## 3. MAPEAMENTO DETALHADO DOS MÓDULOS E RISCOS JURÍDICOS ESPECÍFICOS

### 3.1. Módulo de Estoque, Materiais e Importação de NF-e (`MOD-02`)
**O que o módulo faz:**
* Cadastro de produtos, materiais e insumos com código sequencial automático, código de barras/SKU, unidade de medida, categoria e depósito/almoxarifado (`warehouses`).
* Precificação: Registro de preço de custo, cálculo de margem de lucro sugerida, preço de venda e **Preço Mínimo de Venda** (trava de segurança para orçamentos/vendas).
* Controle de saldo em estoque (`quantity_on_hand`) e alertas de estoque mínimo (`min_stock`).
* **Prevenção e Unificação de Duplicidades:** O sistema identifica produtos com nomes/códigos idênticos para impedir cadastros duplicados e realiza consolidação/soma de saldos.
* **Importação de Nota Fiscal de Entrada (XML e PDF):** Leitura automatizada de arquivos XML de NF-e e arquivos PDF de notas de fornecedores para cadastrar produtos ou somar automaticamente as quantidades adquiridas ao saldo de estoque existente.
* **Histórico de Movimentações (`inventory_movements`):** Registro auditável de entradas manuais, saídas, ajustes de inventário, baixas automáticas por vendas/aprovação de orçamentos e consumo de insumos em serviços.

**Riscos Jurídicos e Isenções Necessárias:**
* **Divergência de Inventário Físico vs. Sistema:** O saldo exibido no sistema reflete estritamente as entradas e saídas lançadas pelos usuários. Furtos, perdas físicas, quebras não lançadas ou erros de contagem são de responsabilidade da empresa usuária.
* **Conferência na Importação de XML/PDF:** A leitura automatizada de XML/PDF de notas fiscais (inclusive conversão de unidades como caixas vs. unidades avulsas e atualização de preço de custo) depende da formatação do arquivo de origem. **O usuário deve obrigatoriamente revisar os itens, quantidades e custos na tela de pré-visualização antes de confirmar a importação.** O sistema não responde por prejuízos decorrentes de precificação incorreta gerada por importação não conferida.

---

### 3.2. Módulo de Vendas, Frente de Caixa (PDV) e Documentos Fiscais (`MOD-01`)
**O que o módulo faz:**
* **Terminal PDV (`/orcafacil/sales/pdv`) e Venda Rápida (`/orcafacil/sales/new`):** Registro de vendas de produtos e serviços com suporte a leitor de código de barras, atalhos de teclado, seleção de cliente e vendedor/operador.
* **Meios de Pagamento Registrados:** Dinheiro (com cálculo de troco), PIX, Cartão de Crédito, Cartão de Débito, Boleto e Crediário/Outros.
* **Integração Automática:** Ao finalizar uma venda:
  1. Exige que haja uma sessão de caixa aberta (PDV ou Caixa Geral);
  2. Deduz automaticamente do estoque a quantidade dos produtos vendidos;
  3. Deduz automaticamente do estoque os **insumos/materiais vinculados aos serviços** vendidos;
  4. Lança o valor correspondente na sessão de caixa aberta e no controle financeiro.
* **Emissão de Comprovante / Recibo (`SaleReceiptModal`):** Impressão térmica (cupom 80mm) ou padrão A4 de comprovante de venda não-fiscal.
* **Painel de Notas Fiscais (`FiscalInvoiceModal` / `SalesInvoicesPage`):** Funcionalidade de registro e geração de metadados de documentos fiscais (`NF-e` modelo 55 e `NFC-e` modelo 65).

**⚠️ PONTO CRÍTICO JURÍDICO — FISCAL, TRIBUTÁRIO E MEIOS DE PAGAMENTO:**
> 1. **Natureza do Módulo Fiscal (`homologacao` / Controle Interno):** Na versão atual da arquitetura, a geração de dados de NF-e/NFC-e no módulo de vendas opera em ambiente de **homologação/simulação e controle gerencial interno**, gerando chaves e protocolos demonstrativos sem transmissão direta via certificado digital ICP-Brasil (A1/A3) aos webservices oficiais da SEFAZ ou Prefeituras.
> 2. **Exclusão de Responsabilidade Tributária:** Os Termos de Uso devem declarar expressamente que **a Empresa Contratante é a única e exclusiva responsável pelo cumprimento de suas obrigações tributárias principais e acessórias** perante a Receita Federal, Secretarias de Fazenda Estaduais (SEFAZ) e Prefeituras Municipais, bem como pela emissão de documentos fiscais oficiais nos portais governamentais ou emissores homologados, parametrizando corretamente alíquotas, CFOP, NCM, CST/CSOSN, ICMS e ISS.
> 3. **Não Processamento Financeiro (TEF / Gateways):** O sistema **não realiza captura ou liquidação financeira real** de cartões de crédito/débito ou PIX. Quando o operador seleciona "PIX" ou "Cartão" no PDV, o sistema apenas registra contabilmente aquela forma de pagamento. É dever exclusivo do operador do caixa conferir se o valor efetivamente caiu na conta bancária ou foi aprovado na maquininha (POS) antes de liberar a mercadoria ao cliente.

---

### 3.3. Módulo de Gerenciamento de Caixa, Sangrias e Boletos (`MOD-05`)
**O que o módulo faz:**
* **Controle de Turnos / Sessões de Caixa (`cash_sessions`):** Abertura de caixa (com saldo inicial / fundo de troco) e fechamento cego ou conferido (comparando o saldo calculado pelo sistema com o valor físico contado pelo operador, apurando sobras ou quebras de caixa).
* **Movimentações Manuais:** Registro de **Sangrias** (retiradas de valores do caixa) e **Suprimentos** (aportes de troco), com justificativa e identificação do operador.
* **Contas a Pagar e Leitor de Boletos em PDF (`cash-bills.service.ts` / `boleto-pdf-parser.service.ts`):**
  * Permite cadastrar contas a pagar manualmente ou fazer upload de um **arquivo PDF de boleto bancário**.
  * O sistema extrai automaticamente (via parser de texto PDF) a linha digitável, código de barras, banco emissor, valor do documento, data de vencimento e beneficiário/fornecedor.
  * Emite alertas visuais de contas próximas do vencimento ou vencidas (`UpcomingBillsAlertModal`).
  * Permite dar baixa na conta ("Pagar Conta"), deduzindo opcionalmente o valor do saldo do Caixa Geral aberto.

**⚠️ PONTO CRÍTICO JURÍDICO — OPERAÇÕES BANCÁRIAS E LEITURA DE BOLETOS:**
> 1. **Ausência de Liquidação Bancária (O Sistema Não é Banco):** Dar baixa em um boleto ou conta a pagar dentro do sistema (`PayBillModal`) constitui **apenas um registro gerencial interno** para controle de fluxo de caixa. **O sistema NÃO envia ordens de pagamento à rede bancária nem liquida títulos no DDA/FEBRABAN.** O pagamento real deve ser efetuado pelo usuário em seu *Internet Banking* ou instituição financeira.
> 2. **Falibilidade da Leitura Automatizada de PDF (Parser de Boletos):** A extração automática de dados de boletos em PDF é um recurso de conveniência sujeito a variações de layout bancário, fontes corrompidas ou PDFs escaneados. **A Empresa Contratante tem o dever de conferir o valor, a data de vencimento e o beneficiário antes de salvar.** A fornecedora do software exime-se de qualquer responsabilidade por esquecimento de pagamento, perda de prazos de vencimento, multas, juros, protestos cartorários ou negativação de CNPJ decorrentes de falhas de cadastro ou não exibição de alertas na tela.

---

### 3.4. Módulo de Orçamentos e Portal Público do Cliente (`MOD-04`)
**O que o módulo faz:**
* Criação de propostas comerciais detalhadas (produtos e serviços), aplicação de descontos, definição de prazo de validade (`valid_until`) e observações comerciais.
* **Trava de Preço Mínimo (`minimum-sale-price.ts`):** Valida se o preço unitário praticado respeita o limite mínimo configurado no estoque.
* Exportação do orçamento em **PDF padronizado** e compartilhamento rápido via **WhatsApp** (`wa.me`).
* **Portal Público de Orçamentos do Cliente (`/portal/orcamentos/:token`):**
  * Gera um link externo com token criptográfico único para o cliente final.
  * Para visualizar os detalhes e valores, se o cliente possuir CPF/CNPJ cadastrado, o portal exige que o cliente final **confirme os dígitos de seu CPF/CNPJ** (camada de segurança e autenticação).
  * O cliente final pode clicar em **"Aprovar Orçamento"** ou **"Recusar"** diretamente pelo celular/navegador, registrando data/hora (`approved_at`) e autoria (`approved_by: 'client'`).
* **Faturamento de Orçamento:** Conversão direta do orçamento aprovado em venda concluída, baixando o estoque e lançando no caixa.

**⚠️ PONTO CRÍTICO JURÍDICO — RELAÇÃO DE CONSUMO (CDC) E ACEITE ELETRÔNICO:**
> 1. **Vinculação da Oferta (Art. 30 e 35 do CDC):** A relação comercial estabelecida através do orçamento enviado em PDF, WhatsApp ou Portal Público dá-se **exclusivamente entre a Empresa Usuária (fornecedora do produto/serviço) e o seu Cliente Final (consumidor)**. A desenvolvedora do software não é parte na cadeia de fornecimento dos produtos ou serviços orçados.
> 2. **Validade do Aceite no Portal do Cliente:** A aprovação realizada pelo cliente final por meio do token único e validação de documento (CPF/CNPJ) constitui evidência técnica de manifestação de vontade para fins da Empresa Usuária, cabendo a esta manter os cadastros de CPF/CNPJ de seus clientes corretos e atualizados para garantir a segurança da validação.

---

### 3.5. Módulo de Ordem de Serviço — O.S. (`MOD-10`) e Catálogo de Serviços (`MOD-09`)
**O que o módulo faz:**
* **Catálogo de Serviços (`MOD-09`):** Cadastro de serviços prestados, categorias, cálculo de custo operacional (mão de obra, insumos do estoque vinculados, alíquota de ISS, taxas de cartão, comissões) e margem de lucro líquida.
* **Gestão Completa de Ordens de Serviço (`MOD-10`):**
  * Identificação do cliente e prioridade da O.S. (`baixa`, `normal`, `alta`, `urgente`).
  * Identificação do equipamento/bem deixado pelo cliente: nome, marca, modelo, número de série/IMEI, cor e acessórios deixados.
  * **Registro de Senha do Dispositivo (`device_password`):** Campo específico para armazenar a senha ou padrão de desbloqueio de celulares, computadores ou equipamentos deixados para manutenção.
  * **Vistoria de Entrada:** Checklist de avarias pré-existentes (`damage_checklist`), observações de danos (`damage_notes`) e **upload de fotos do equipamento** (`photos`).
  * **Laudo Técnico:** Problema relatado pelo cliente (`reported_problem`), diagnóstico técnico (`technical_diagnosis`), solução aplicada (`solution_applied`) e nome do técnico responsável.
  * **Garantia:** Prazo de garantia em dias (`warranty_days`) e termos de garantia personalizados (`warranty_terms`).
  * Impressão de via de entrada/saída da O.S. (com espaço para assinatura física do cliente) e envio por WhatsApp.

**⚠️ PONTO CRÍTICO JURÍDICO — GUARDA DE BENS, SENHAS DE DISPOSITIVOS E GARANTIA:**
> 1. **Armazenamento de Senhas de Aparelhos de Clientes (`device_password`):** Como o sistema permite que a assistência técnica anote a senha de desbloqueio do aparelho do cliente final, **os Termos devem atribuir responsabilidade civil, criminal e perante a LGPD exclusivamente à Empresa Usuária e seus técnicos** pelo sigilo dessa senha, pelo acesso a dados íntimos/bancários contidos no aparelho em reparo e pela recomendação de apagar a senha após a entrega do equipamento.
> 2. **Termos de Garantia Personalizados (`warranty_terms`):** Os prazos e cláusulas de garantia impressos na O.S. são redigidos ou parametrizados pela própria Empresa Usuária, que responde integralmente por sua conformidade com o Código de Defesa do Consumidor (Art. 26 e Art. 50 do CDC).
> 3. **Fotos e Checklist de Avarias:** Cabe à Empresa Usuária realizar a vistoria presencial e colher a assinatura do cliente no ato do recebimento do bem físico.

---

### 3.6. Módulo de Clientes (`MOD-03`), Fornecedores (`MOD-06`) e LGPD
**O que o módulo faz:**
* **Clientes (`customers`):** Armazena Nome/Razão Social, Tipo de Pessoa (PF/PJ), CPF/CNPJ (com validação de dígitos verificadores), Telefone/WhatsApp, E-mail, CEP (com busca automatizada via API pública de CEP), Endereço completo e Observações.
* **Fornecedores (`suppliers`):** Armazena Razão Social, Nome Fantasia, CNPJ/CPF, Inscrição Estadual, Contato, Telefone, E-mail, Endereço, Categoria e histórico de notas fiscais de compra vinculadas.

**⚠️ PONTO CRÍTICO JURÍDICO — PROTEÇÃO DE DADOS PESSOAIS (LGPD — LEI Nº 13.709/2018):**
> 1. **Definição Legal dos Agentes de Tratamento (Art. 5º da LGPD):**
>    * **CONTROLADORA (*Controller*):** É a **Empresa Contratante (Usuária do Sistema)** em relação aos dados pessoais de seus clientes finais, fornecedores e colaboradores que ela insere ou importa na plataforma. Cabe à Empresa Contratante definir a finalidade, colher o consentimento (quando aplicável), garantir a base legal (execução de contrato, obrigação legal, legítimo interesse) e atender às solicitações dos titulares (exclusão, correção, portabilidade).
>    * **OPERADORA (*Processor*):** É a **Fornecedora do Software (JB Gestão / ControleSoft)**, que realiza o armazenamento e processamento técnico dos dados estritamente em nome e sob as instruções da Controladora, mantendo medidas técnicas de segurança e isolamento (*Row-Level Security*).
>    * *(Nota: A Fornecedora do Software atua como Controladora apenas em relação aos dados cadastrais dos próprios representantes da Empresa Contratante para fins de faturamento da licença, autenticação e telemetria de uso do software).*

---

### 3.7. Módulo de Migração e Importação em Massa (`MOD-11`)
**O que o módulo faz:**
* Permite baixar planilhas-modelo (templates) e importar arquivos **Excel (`.xlsx`) e CSV** para cadastrar em massa: Clientes, Produtos/Estoque, Fornecedores e Serviços (`MigrationHubPage` / `import-engine.service.ts`).

**Riscos Jurídicos e Isenções:**
* **Integridade e Licitude da Base Importada:** A Empresa Contratante declara que possui direito legítimo sobre as bases de dados importadas de sistemas anteriores (sem violação de propriedade intelectual ou LGPD) e assume total responsabilidade por erros de mapeamento de colunas, valores monetários incorretos ou duplicações causadas por planilhas mal formatadas.

---

### 3.8. Módulo de Relatórios (`MOD-08`), Agenda (`AgendaPro`) e Suporte com IA
**O que o sistema faz:**
* **Relatórios Gerenciais (`MOD-08`):** Emissão, filtragem por período, visualização e impressão de relatórios de Vendas/Faturamento, Fechamentos de Caixa, Posição de Estoque, Clientes e Fornecedores.
* **Agenda de Compromissos (`/agenda`):** Calendário de agendamentos operacionais, vinculação com clientes/serviços e controle de status de atendimento (`agendado`, `confirmado`, `concluído`, `cancelado`).
* **Widget de Suporte, Sugestões e Assistente de IA (`FeedbackWidget` / `support-ai.service.ts`):**
  * Canal para envio de dúvidas, relatos de bugs e sugestões de melhoria pelos usuários.
  * Assistente automatizado para orientar o usuário sobre como utilizar as telas e funções do sistema.
* **Telemetria e Monitoramento de Sessão (`screen-time.service.ts`):**
  * Registro do tempo ativo de uso da plataforma e último acesso (`last_access_at`) de cada organização e usuário, utilizado para métricas de engajamento, suporte técnico e auditoria administrativa.

**Riscos Jurídicos e Isenções:**
* **Natureza Gerencial dos Relatórios:** Os demonstrativos financeiros e de lucro gerados no módulo `MOD-08` possuem finalidade **estritamente gerencial e estimativa**, não equivalendo a Balanço Patrimonial, DRE contábil oficial ou escrituração fiscal (SPED).
* **Respostas do Assistente de IA:** As orientações fornecidas pelo chat automatizado de suporte têm caráter meramente informativo sobre a operação do sistema, não configurando consultoria contábil, jurídica ou garantia contratual.
* **Consentimento de Telemetria:** Os Termos e a Política de Privacidade devem prever expressamente a coleta de logs de acesso, endereço IP, navegador e métricas de tempo de tela (`screen_time`) para fins de segurança da informação, prevenção a fraudes, suporte e melhoria contínua do produto.

---

## 4. GOVERNANÇA DA PLATAFORMA, PLANOS, BLOQUEIOS E INFRAESTRUTURA (ADMINISTRAÇÃO SAAS)

O sistema conta com recursos administrativos operados pelo Proprietário do Sistema (`System Owner`) que **precisam estar respaldados em cláusulas contratuais claras** para evitar alegações de interrupção arbitrária de serviço:

### 4.1. Período de Testes (*Trial*), Planos de Acesso e Bloqueio (`is_active`)
* **Como funciona tecnicamente:**
  * Cada empresa cadastrada pode receber um **Plano de Acesso** (`access_plans`) que determina quais módulos (`MOD-01` a `MOD-11`) estão liberados.
  * Empresas podem ter uma data limite de avaliação gratuita (`trial_ends_at`).
  * O Proprietário do Sistema pode alternar o status da empresa entre **Ativa (`is_active = true`)** e **Inativa/Suspensa (`is_active = false`)**, o que bloqueia imediatamente o acesso de todos os usuários daquela organização ao sistema.
* **Respaldo Jurídico Necessário nos Termos:**
  * Previsão expressa de que, encerrado o período de *Trial* sem contratação definitiva, ou em caso de **inadimplência** superior a $X$ dias, ou ainda em caso de violação dos Termos de Uso / suspeita de fraude, o acesso aos módulos será **automaticamente suspenso ou bloqueado**, sem que isso configure ilícito contratual ou gere dever de indenizar por interrupção das atividades comerciais do cliente.
  * Definição do prazo de guarda dos dados após o cancelamento ou rescisão (ex.: 30 a 90 dias para solicitação de exportação antes da exclusão definitiva do banco de dados).

### 4.2. Modo de Manutenção Global (`SystemMaintenanceScreen`) e Atualizações (`SystemUpdates`)
* **Como funciona tecnicamente:**
  * O administrador global pode ativar uma tela de **Manutenção do Sistema** com previsão de retorno, além de disparar avisos de atualização de versão (`useSystemVersion` / `SystemNotificationModal`) e banners informativos (`AnnouncementCarousel`).
* **Respaldo Jurídico Necessário nos Termos:**
  * Cláusula de **Janela de Manutenção** (programada ou emergencial) e atualização contínua do software SaaS, descontando tais períodos de qualquer cálculo de disponibilidade (SLA).

### 4.3. Infraestrutura de Terceiros e Limitação de Responsabilidade (SLA)
* **Como funciona tecnicamente:**
  * O sistema opera sobre infraestrutura de nuvem de padrão internacional (**Supabase / PostgreSQL / AWS** para banco de dados e autenticação, e **Vercel / CDN** para hospedagem da aplicação web), além de integrar com links externos do **WhatsApp (`wa.me`)** e APIs públicas de consulta de CEP/CNPJ.
* **Respaldo Jurídico Necessário nos Termos:**
  * **Excludente por Fato de Terceiro / Caso Fortuito:** Isenção de responsabilidade por indisponibilidades causadas por queda de provedores de nuvem globais (AWS, Supabase, Vercel), falhas de conexão de internet do próprio usuário, instabilidades no aplicativo WhatsApp ou indisponibilidade de APIs governamentais/públicas.
  * **Teto Indenizatório (Limitação de Responsabilidade):** Limitação de eventual responsabilidade civil da Fornecedora do Software aos **danos diretos comprovados**, limitada ao valor total pago pela Empresa Contratante a título de mensalidades nos últimos **3 (três) ou 6 (seis) meses** anteriores ao evento danoso, **excluindo-se expressamente lucros cessantes, perda de chance, danos indiretos ou multas fiscais**.

---

## 5. CHECKLIST RESUMO PARA O ADVOGADO / REDAÇÃO DOS TERMOS

Para facilitar o trabalho jurídico, abaixo estão os **10 pontos contratuais indispensáveis** que devem constar nos Termos de Uso e Contrato SaaS do **ControleSoft / JB Gestão**:

| # | Tema Jurídico | O que o Termo de Uso DEVE deixar explícito |
| :--- | :--- | :--- |
| **1** | **Natureza Não-Fiscal / Homologação** | O sistema é de gestão operacional. A emissão de NF-e/NFC-e no sistema tem caráter gerencial/homologação. A emissão fiscal oficial perante SEFAZ/Prefeitura e o recolhimento de impostos são de responsabilidade exclusiva do usuário e de seu contador. |
| **2** | **Não Liquidação Bancária (Caixa e Boletos)** | O sistema não é banco nem processadora de cartões. Registrar vendas em PIX/Cartão ou dar "baixa" em boletos no módulo de Caixa é apenas controle interno e não movimenta dinheiro real na rede bancária. |
| **3** | **Conferência de Automação (XML e PDF)** | Os leitores automáticos de XML de NF-e e de Boletos em PDF são ferramentas de auxílio. O usuário tem obrigação de conferir valores, quantidades, custos e vencimentos antes de confirmar a operação. |
| **4** | **Atos de Funcionários e Senhas** | O titular da conta empresarial responde integralmente pelos atos de seus funcionários (`admin` e `member`), devendo gerenciar as permissões granulares (`MOD-01` a `MOD-11`) e revogar acessos imediatamente em caso de demissão. |
| **5** | **Guarda de Senhas de Aparelhos em O.S.** | No módulo de Ordem de Serviço (`MOD-10`), o registro da senha de desbloqueio do aparelho do cliente e as fotos de vistoria são de inteira responsabilidade e guarda sigilosa da empresa usuária. |
| **6** | **Relação de Consumo com Cliente Final (CDC)** | Orçamentos, garantias de O.S., preços e prazos enviados pelo sistema ou aprovados no Portal Público do Cliente vinculam exclusivamente a Empresa Usuária e seu consumidor final, sem corresponsabilidade da fornecedora do software. |
| **7** | **Papéis na LGPD (Controlador vs. Operador)** | A Empresa Usuária é a **Controladora** dos dados pessoais de seus clientes, fornecedores e funcionários; a fornecedora do software é a **Operadora** da infraestrutura tecnológica. |
| **8** | **Migração e Veracidade de Dados** | Dados importados via planilhas Excel/CSV (`MOD-11`) são de inteira responsabilidade do usuário quanto à formacidade, exatidão dos saldos e origem lícita. |
| **9** | **Suspensão por Inadimplência ou Fim de Trial** | Autorização expressa para bloqueio imediato do acesso (`is_active = false`) após o vencimento do período de teste gratuito (*Trial*) ou inadimplência, bem como janelas de manutenção do sistema. |
| **10** | **Limitação de Responsabilidade (Teto)** | Exclusão de responsabilidade por lucros cessantes, falhas de internet/terceiros (AWS/Supabase/WhatsApp) e limitação de indenização ao valor das últimas mensalidades pagas pela licença de uso. |
