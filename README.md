# SAVYRON — MAICON

Plataforma **multi-tenant** de **prospecção comercial automatizada** e atendimento
com IA. Importe ou prospecte leads na web (e agora também de **grupos do
WhatsApp**), crie campanhas e deixe que o WhatsApp, o e-mail e um agente de IA
conversem com os clientes — tudo com limites diários, opt-out obrigatório,
planos/assinaturas (Stripe/Cakto/AbacatePay) e auditoria completa.

> **Stack:** Monorepo · Next.js 14 (App Router) · Node.js 20 · TypeScript ·
> Prisma 6 · Neon PostgreSQL · Redis + BullMQ · Baileys (WhatsApp) · Resend
> (e-mail) · NVIDIA NIM + Groq + OpenRouter (IA) · Kokoro (TTS self-hosted) +
> Groq Whisper (STT) · Socket.IO · Stripe + Cakto + AbacatePay (pagamentos) ·
> Firecrawl + Overpass/OSM (prospecção web) · Apify · Scrapy ·
> PM2 · Nginx + Let's Encrypt · PWA

## Arquitetura

```
CRM/
├── apps/
│   ├── dashboard/   # Frontend Next.js (porta 3005) — dark/light, mobile-first, PWA
│   │                #   Rotas públicas e autenticadas (ver "Navegação" abaixo)
│   │                #   Inclui /agente — MAICON V2: núcleo visual orbital + voz
│   ├── api/         # API REST Express (porta 4005) — auth, rotas, filas, Socket.IO
│   │                #   Rotas extras: /agent, /calendar, /financial, /memory,
│   │                #   /whatsapp/groups (JARVIS + módulos do agente)
│   └── worker/      # Worker BullMQ (porta 5005) — processa filas + WhatsApp
├── services/        # Lógica compartilhada: ai, email, leads, prospector, whatsapp
│   └── scrapy/      # Serviço Python (Scrapy/FastAPI) de enriquecimento de leads (PM2)
├── packages/        # Pacotes: database (Prisma), config, logger, queues, types, utils
├── scripts/         # build, deploy, ssl, clean-db, gerador de leads/ícones PWA
├── tests/           # 51 arquivos de teste (~550 subtests, node --test)
├── nginx/           # Config de proxy reverso com SSL
├── logs/            # Logs do PM2 (dashboard/api/worker/scrapy *.out.log e *.err.log)
├── session/         # Sessão persistente do WhatsApp (Baileys) — não versionar
└── backups/         # Backups do banco e sessão WhatsApp
```

### Filas (BullMQ)

| Fila | Função |
|---|---|
| `lead-import` | Parse, validação, deduplicação e gravação de importações |
| `campaign-processing` | Pump da campanha: respeita limites diários e intervalo |
| `whatsapp-send` | Envio de mensagens WhatsApp (Baileys) |
| `email-send` | Envio de e-mails (Resend) |
| `message-received` | Respostas recebidas (dispara o agente) |
| `ai-response` | Geração de resposta da IA (NVIDIA NIM → Groq → OpenRouter) |
| `conversation-learning` | Análise de conversas por tenant (gera insights + estratégias aprendidas) |
| `webhook-processing` | Eventos dos gateways/Resend (entrega, abertura, clique, bounce…) |
| `prospection` | Prospecção web (Firecrawl **ou** Overpass/OSM): descoberta, crawling e criação de leads |
| `lead-enrichment` | Enriquecimento de leads via serviço Scrapy (e-mail, telefone, WhatsApp) |
| `whatsapp-group-extraction` | Extração de contatos de grupos do WhatsApp (Baileys) para leads |
| `retry` | Retry com backoff (máx. 3 tentativas para WhatsApp) |
| `dead-letter` | Falhas permanentes (log estruturado e lead marcado como `ERROR`) |

---

## Banco de dados

Banco **PostgreSQL** (Neon) via **Prisma 6** ORM. Sem Supabase, sem RLS, sem
funções armazenadas — isolamento multi-tenant por `business_id` em todas as
tabelas de domínio, toda lógica de negócio em TypeScript.

### Enums principais

| Enum | Valores |
|---|---|
| `LeadStatus` | `PENDING` · `PROCESSING` · `SENT` · `RESPONDED` · `AGENT_ACTIVE` · `INTERESTED` · `NOT_INTERESTED` · `OPT_OUT` · `ERROR` |
| `CampaignStatus` | `ACTIVE` · `PAUSED` · `FINISHED` |
| `ChannelMode` | `WHATSAPP` · `EMAIL` · `BOTH` (Instagram removido) |
| `MessageChannel` | `WHATSAPP` · `EMAIL` |
| `MessageDirection` | `IN` · `OUT` |
| `MessageStatus` | `QUEUED` · `PROCESSING` · `SENT` · `DELIVERED` · `READ` · `FAILED` |
| `ConversationStage` | `NEW` · `QUALIFYING` · `DISCOVERY` · `EVALUATION` · `NEGOTIATION` · `CLOSED_WON` · `CLOSED_LOST` |
| `ConversationStatus` | `OPEN` · `CLOSED` |
| `LeadSource` | `CSV` · `MANUAL` · `TEST` · `WEB` · `WHATSAPP_GROUP` |
| `ProspectionStatus` | `PENDING` · `RUNNING` · `COMPLETED` · `PARTIAL` · `FAILED` · `CANCELLED` |
| `BusinessStatus` | `PENDING_PAYMENT` · `TRIAL` · `ACTIVE` · `PAST_DUE` · `SUSPENDED` · `CANCELLED` |
| `BusinessRole` | `OWNER` · `BUSINESS_ADMIN` · `MANAGER` · `AGENT` |
| `PlatformRole` | `NONE` · `PLATFORM_ADMIN` · `PLATFORM_STAFF` |
| `AITone` | `PROFESSIONAL` · `FRIENDLY` · `CASUAL` · `RELAXED` · `PREMIUM` · `CONSULTATIVE` · `TECHNICAL` |
| `AIKnowledgeCategory` | `PRODUCTS` · `SERVICES` · `PLANS` · `PRICES` · `PROMOTIONS` · `HOURS` · `DAYS` · `PAYMENT` · `ADDRESS` · `FAQ` · `POLICIES` · `BENEFITS` · `COMMERCIAL_RULES` · `LINKS` · `INTERNAL_RULES` |
| `SubscriptionStatus` | `TRIALING` · `ACTIVE` · `PAST_DUE` · `CANCELLED` · `EXPIRED` · `SUSPENDED` |
| `PaymentStatus` | `PENDING` · `CONFIRMED` · `RECEIVED` · `OVERDUE` · `CANCELLED` · `REFUNDED` |
| `PaymentMethod` | `PIX` · `CARD` |
| `InsightOutcome` | `CONVERTED` · `ABANDONED` · `LOST` · `ONGOING` |
| `StrategyStatus` | `LEARNING` · `ACTIVE` · `DISCARDED` |
| `MemoryCategory` | `PREFERENCE` · `GOAL` · `METRIC` · `DECISION` · `CONTEXT` · `INSTRUCTION` · `NOTE` |
| `CalendarEventStatus` | `SCHEDULED` · `CONFIRMED` · `CANCELLED` · `COMPLETED` |
| `CalendarEventPriority` | `LOW` · `NORMAL` · `HIGH` · `URGENT` |
| `RecurrenceType` | `NONE` · `DAILY` · `WEEKLY` · `MONTHLY` · `YEARLY` |
| `TransactionType` | `INCOME` · `EXPENSE` |
| `TransactionStatus` | `REAL` · `PLANNED` · `CANCELLED` |

### Tabelas (39 modelos)

#### Autenticação / Plataforma

| Tabela | Campos-chave | Relações |
|---|---|---|
| **User** | `id`, `email` (unique), `password_hash`, `name`, `role` (ADMIN), `platform_role`, `active`, `must_change_password` | 1:N → `BusinessMember` |
| **Setting** | `key` (PK), `value` | Store chave-valor global |
| **EmailVerification** | `email`, `code_hash`, `expires_at`, `attempts`, `verified_at` | Índice em `(email, created_at)` |
| **ApiKey** | Chaves de API de provedores (rotação de chaves) | FK → `Business` |

#### Multi-tenant (empresa)

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Business** | `id`, `name`, `slug` (unique), `status` (BusinessStatus), `cnpj`, `segment`, `description` | Pai de todas as tabelas de domínio |
| **BusinessSettings** | 1:1 com Business — `whatsapp_daily_limit`, `email_daily_limit`, `interval_seconds`, `timezone`, `target_audience`, `problems_solved`, `differentials`, `positioning`, `service_area`, `business_objectives`, `additional_instructions` | FK → `Business` CASCADE |
| **BusinessMember** | Join User↔Business — `role` (BusinessRole) | UNIQUE `(business_id, user_id)` |

#### Leads

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Lead** | `name`, `phone`, `email`, `business_name`, `city`, `state`, `source` (inclui `WHATSAPP_GROUP`), `status`, `website`, `whatsapp`, `lead_score`, `segment` | UNIQUE por `(business_id, phone)`, `(business_id, email)`, `(business_id, external_id)` |
| **LeadImport** | `filename`, `source`, `status`, `total`, `new_leads`, `duplicates`, `invalid`, `summary` (JSON) | FK → `Business` |
| **ProspectionRun** | `segment`, `city`, `state`, `country`, `target_quantity`, `status`, `sources` (JSONB: `["google_maps", "instagram"]`), `found_count`, `saved_count`, `avg_score` | FK → `Business`, opcional `Campaign` |
| **WhatsAppGroupExtraction** | Extração de contatos de grupos — status, destino (`leads`/`enrich`/`campaign`), `confirm_legal` | FK → `Business` |
| **WhatsAppGroupSource** | Grupos selecionados como fonte | FK → `WhatsAppGroupExtraction` |
| **WhatsAppGroupLead** | Contatos extraídos por grupo | FK → `WhatsAppGroupExtraction` |

#### Campanhas

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Campaign** | `name`, `status`, `daily_whatsapp_limit`, `daily_email_limit`, `interval_seconds`, `is_test`, `start_hour`, `channel_mode` (WHATSAPP/EMAIL/BOTH), `email_subject`, `email_body`, `wa_first_message` | FK → `Business` |
| **CampaignLead** | Join Campaign↔Lead — `status`, `attempts`, `next_attempt_at`, `channel` | UNIQUE `(business_id, campaign_id, lead_id)` |

#### Mensagens

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Message** | `channel`, `direction`, `content`, `status`, `provider`, `external_id` | Partial unique para idempotência (IN+OUT) |
| **EmailLog** | `to`, `subject`, `status`, `provider`, `provider_message_id`, `error` | FK → `Business` |
| **DeliveryEvent** | `event`, `payload` (JSON) | FK → `Message` (SET NULL) |

#### Conversas

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Conversation** | `status`, `ai_provider`, `human_handled`, `stage` (ConversationStage), `last_technique_used` | UNIQUE `(business_id, lead_id)` |
| **ConversationMemory** | `key`, `summary`, `current_goal`, `next_action`, `sales_stage`, `known_json` (JSON), `asked_questions` (JSON) | UNIQUE `(business_id, key)` |

#### IA

| Tabela | Campos-chave | Relações |
|---|---|---|
| **AIGeneration** | Audit log — `provider`, `model`, `prompt_version`, `technique_used`, `prompt`, `completion`, `input_tokens`, `output_tokens`, `latency_ms` | FK → `Business`, `Lead`, `Conversation` |
| **AIAgent** | Per-business — `name`, `role`, `description`, `objective`, `active` | FK → `Business` |
| **AISettings** | 1:1 com Business — `tone` (AITone), `behaviors` (JSON), `message_config` (JSON), `custom_prompt`, `agent_mode` (sales/support/sales_support) | FK → `Business`, opcional `AIAgent` |
| **AIKnowledge** | Base de conhecimento — `title`, `content`, `category`, `keywords`, `active` | FK → `Business` |

#### Motor de aprendizado

| Tabela | Campos-chave | Relações |
|---|---|---|
| **SalesConversationInsight** | Análise por conversa — `outcome`, `message_count`, `pains` (JSON), `objections` (JSON), `needs` (JSON), `techniques` (JSON), `strategy_used` | UNIQUE `conversation_id`, FK → `Business` |
| **CommercialStrategy** | Estratégia aprendida por tenant — `strategy_id`, `version`, `name`, `segment`, `recommended_next_action`, `sample_count`, `confidence`, `success_rate`, `status` | UNIQUE `(business_id, strategy_id, version)` |

#### Billing

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Plan** | `name`, `slug` (unique), `price`, `billing_interval`, `trial_days`, `stripe_product_id`, `stripe_price_id`, `cakto_product_id`, `cakto_offer_id` | 1:N → `PlanFeature` |
| **PlanFeature** | `feature`, `enabled`, `limit` | UNIQUE `(plan_id, feature)` |
| **Subscription** | 1:1 com Business — `status`, `plan_name`, `plan_price`, `stripe_customer_id`, `stripe_subscription_id`, `cakto_subscription_id`, `cakto_checkout_url`, `abacatepay_customer_id`, `abacatepay_checkout_id`, `current_period_start/end`, `trial_ends_at` | FK → `Plan` (SET NULL) |
| **Payment** | `method`, `status`, `value`, `stripe_payment_intent_id`, `cakto_order_id`, `abacatepay_checkout_id`, `abacatepay_event`, `pix_payload`, `pix_qr_base64`, `paid_at` | FK → `Subscription` CASCADE |

#### Módulos do agente (JARVIS)

| Tabela | Campos-chave | Relações |
|---|---|---|
| **Memory** | Memórias por usuário — `content`, `category` (MemoryCategory), `importance`, `source`, `expires_at` | FK → `Business`, índice `(business_id, user_id)` |
| **CalendarEvent** | `title`, `status`, `priority`, `recurrence` (RecurrenceType), `start_date`, `end_date`, `all_day` | FK → `Business` |
| **Reminder** | Lembretes vinculados à agenda | FK → `Business` |
| **FinancialCategory** | Categorias de receita/despesa — `name`, `type` | FK → `Business` |
| **FinancialTransaction** | `type` (INCOME/EXPENSE), `status` (REAL/PLANNED), `value`, `date`, `description` | FK → `Business`, `FinancialCategory` |

#### Outras

| Tabela | Campos-chave | Relações |
|---|---|---|
| **OptOut** | `channel`, `reason` | FK → `Lead` CASCADE |
| **Usage** | `metric`, `quantity`, `period` | UNIQUE `(business_id, metric, period)` |
| **AuditLog** | `actor`, `action`, `entity`, `entity_id`, `metadata` (JSON) | FK → `Business` SET NULL |
| **Notification** | `type`, `title`, `description`, `preview`, `read` | FK → `Business` |

### Histórico de migrações (36)

```
20260808  init                          # Tabelas iniciais (User, Lead, Campaign, Message, Conversation…)
20260812  multi_tenant                  # Business, BusinessSettings, BusinessMember + business_id em tudo
20260812  billing_onboarding            # Plan, PlanFeature, Subscription, Payment, AuditLog, Usage
20260812  business_settings             # Endereço, site, timezone, logo
20260812  ai_models                     # AIAgent, AISettings, AIKnowledge
20260812  stripe_gateway                # Colunas Stripe em Plan/Subscription/Payment
20260814  cakto_gateway                 # Colunas Cakto (PIX) em Plan/Subscription/Payment
20260814  email_log                     # Tabela EmailLog (histórico Resend)
20260815  lead_enrichment               # Campos whatsapp, website no Lead
20260815  prospection                   # ProspectionRun + campos de enriquecimento
20260816  message_idempotency           # Índices únicos parciais (dedup de mensagens)
20260816  commercial_stages_engine      # ConversationStage enum + rastreamento do motor comercial
20260816  conversation_memory           # Tabela ConversationMemory
20260817  mandatory_onboarding          # Onboarding obrigatório no 1º acesso
20260818  conversation_learning_engine  # SalesConversationInsight + CommercialStrategy
20260819  prospection_apify_sources     # ProspectionRun.sources (JSONB)
20260820  knowledge_base_evolution      # AIKnowledge.keywords
20260820  agent_mode                    # AISettings.agent_mode
20260820  company_context               # BusinessSettings: target_audience, problems_solved, differentials…
20260823  campaign_channel_mode         # ChannelMode enum + Campaign.channel_mode
20260823  campaign_email_message        # Campaign.email_subject, Campaign.email_body
20260827  whatsapp_group_extraction     # WhatsAppGroupExtraction/Source/Lead
20260827  campaign_wa_first_message     # Campaign.wa_first_message
20260829  abacatepay_gateway            # Colunas AbacatePay em Subscription/Payment
20260830  remove_instagram              # Rollback completo do canal Instagram
20260831  whatsapp_group_extraction_feature  # Feature de plano whatsapp_group_extraction
```

---

## Navegação do produto

O SAVYRON é dividido em **área pública** (marketing + onboarding),
**painel do cliente** (por empresa) e **painel administrativo**
(plataforma — só `PLATFORM_ADMIN`/`PLATFORM_STAFF`).

```
Área pública          Painel do cliente (autenticado)              Admin (plataforma)
─────────────────     ────────────────────────────────────────     ─────────────────────
/vitrine (landing)    /dashboard              /settings            /admin
/login                /agente (MAICON V2)     /settings/empresa-ia /admin/businesses
/signup               /prospect               /settings/plano      /admin/plans
/change-password      /campaigns              /ai/knowledge        /admin/subscriptions
/payment              /inbox                  /ai/playground       /admin/payments
                      /clientes               /ai/prompt-guide     /admin/users
                      /agenda                 /reports             /admin/usage
                      /financeiro             /emails              /admin/audit
                                                                   /admin/settings
```

> **Redirecionamentos:** `/settings/business` → `/settings/empresa-ia` (301),
> `/ai/settings` → `/settings/empresa-ia` (301), `/lead-import` → `/prospect?tab=import` (302).

### Papéis e permissões

- **Na empresa** (`businessRole`): `OWNER` → `BUSINESS_ADMIN` → `MANAGER` → `AGENT`.
  Ações destrutivas (limpar leads importados, limpar conversas, limpar sessão do
  WhatsApp, extração de grupos) são restritas a `OWNER`/`BUSINESS_ADMIN` na
  interface; a autorização real é sempre validada na API.
- **Na plataforma** (`platform_role`): `PLATFORM_ADMIN`, `PLATFORM_STAFF`
  (acesso de suporte/leitura) e `NONE`. Apenas quem tem papel de plataforma vê o
  link **Admin** na sidebar e acessa `/admin/*`.

### Sidebar (desktop) — fonte única em `lib/navigation.ts`

| Seção | Itens |
|---|---|
| **Principal** | Início · **Agente** (destaque central no mobile) · Prospecção · Mensagens · Campanhas · Clientes · E-mails enviados · Relatórios · **Agenda** · **Financeiro** |
| **Empresa** | Configuração da IA · Planos |
| **Avançado** (colapsável) | Integrações · Base de conhecimento · Testar IA · Guia de prompts |
| **Inferior** | Logs & Admin (só `PLATFORM_ADMIN`/`STAFF`) · Configurações |

### Bottom nav (mobile)

Início · **Agente** (botão central destacado) · Prospecção · Mensagens + drawer **Mais**
(Campanhas, Clientes, E-mails, Relatórios, Agenda, Financeiro, Empresa, Avançado)

---

## Área pública

| Rota | Conteúdo |
|---|---|
| `/vitrine` | Landing page de marketing: hero, "Como funciona" (4 passos), "Para quem é" (segmentos), "Recursos" (6 cards), "Planos" (cards vindos da API) e CTA final. Botões: **Criar minha conta** → `/signup`, **Ver planos** → `#planos`, **Entrar** → `/login`. |
| `/login` | Login com e-mail/senha (card com efeito 3D). Regras de redirect: `must_change_password` → `/change-password`; `PENDING_PAYMENT` → `/payment`; `SUSPENDED`/`CANCELLED` → erro bloqueante. Link **Cadastre-se** → `/signup`. |
| `/signup` | Onboarding em 3 etapas (stepper): **E-mail** (envio de código de verificação de 6 dígitos, reenviar em 30s, expira em 10min) → **Empresa** (nome, responsável, telefone, segmento, CPF/CNPJ, senha) → **Plano** (cards com features da API, selo "Mais popular" no `enterprise`). Botão final: **Criar conta e seguir para o pagamento** → `/payment`. |
| `/change-password` | Troca de senha obrigatória no 1º acesso (senha atual, nova senha + confirmação; mín. 8 chars com maiúscula, número e símbolo). |
| `/payment` | Página de assinatura pendente: mostra plano/valor, botão **Continuar para pagamento** (Checkout Stripe, link Cakto de PIX recorrente ou PIX AbacatePay quando configurado), **Ativar acesso** para planos gratuitos (R$ 0), botão **Sair**. Redireciona ao `/dashboard` quando pago (polling a cada 5s). |

---

## Painel do cliente

Layout comum (`DashboardShell`): **sidebar** (desktop) com a navegação
principal, depois os grupos *Empresa* (Configurações da IA, Planos), *Avançado*
(Integrações, Base de conhecimento, Testar IA, Guia de prompts) e o link *Admin*;
**topbar** com título, sino de notificações e dropdown do usuário;
**bottom-nav** no mobile com botão central do **Agente**; banner de "modo
suporte" quando o admin está impersonando a empresa; banner offline quando o
WebSocket cai.

### `/dashboard` — Dashboard

Visão geral em tempo real (refetch 15s). Cards e botões:

- Banner **WhatsApp**: `conectado` (verde) / `aguardando QR code` / `desconectado`
  (âmbar) + botão **Gerenciar** → `/settings`.
- **KPIs** (8 cards): *Leads na fila* (âmbar), *Leads importados*, *WhatsApp hoje*
  (hint `limite N`), *E-mails hoje* (hint `limite N`), *Respostas hoje* (azul),
  *Interessados*, *Não interessados*, *Opt-outs*.
- **KPIs secundários** (3 cards): *Campanhas ativas* (azul), *Erros* (vermelho),
  *Mensagens enviadas hoje*.
- Cards de **Limite diário de WhatsApp** e **Limite diário de E-mail** (barra de
  progresso `usado / limite`).
- Card **Campanhas**: lista até 5 campanhas (cada uma linka para
  `/campaigns/[id]`, com badge de teste, status, barra de progresso e total /
  pendentes / respostas / interessados). Botões **Ver todas** → `/campaigns` e,
  quando vazio, **Criar campanha** → `/campaigns`.
- **Seletor de canal**: 3 cards clicáveis — WhatsApp · E-mail · Ambos
  (atualiza o `channel_mode` da campanha ativa).
- Gráfico de pizza (recharts) — performance WhatsApp vs E-mail.
- Relógio de **Brasília** no canto superior direito.

### `/agente` — Agente de voz (MAICON V2)

Assistente de voz em tela cheia (`hideHeader`/`fullBleed`) com núcleo visual
orbital dirigido pelo motor real. Ativado por feature flag
(`SAVYRON_AGENT_CORE_V2`, ON por padrão; rollback = `false`).

- **Núcleo visual SAVYRON** (`components/agent/savyron/`): core orbital,
  partículas, AI background, boca (SavyronMouth) sincronizada com TTS, status
  e indicador de conexão.
- **Voz contínua**: loop de conversa com **VAD adaptativo** (Web Audio API,
  noise gate adaptativo, proteção anti-eco), STT via **Groq Whisper**
  (`POST /agent/transcribe`), chat com ferramentas (`POST /agent/chat`) e TTS
  via **Kokoro self-hosted** (`POST /agent/tts`, WAV) com fallback para a voz
  nativa do navegador.
- **Modo somente-leitura JARVIS**: o agente NÃO altera dados do SAVYRON —
  ferramentas de escrita são bloqueadas em 3 camadas (declaração, filtro e
  execução).
- **Ferramentas do agente** (`apps/api/src/services/tools/`):
  - *Data/hora*: `get_current_datetime`, `parse_date`, `check_event_conflicts`, `find_free_slots`
  - *Agenda*: `list_calendar_events`, `list_reminders`
  - *Memória*: `search_memory`, `list_recent_memories`
  - *Cálculo*: `calculate`, `calculate_projection`, `project_month`, `project_expenses`, `project_income`, `project_sales`
  - *Financeiro*: `get_financial_summary`, `list_financial_transactions`, `get_financial_categories`, `get_financial_projection`
  - *Externo*: `search_web` (DuckDuckGo + fallback Wikipedia), `get_weather`, `get_exchange_rate` (AwesomeAPI), `get_news`, `get_feriados`
  - *SAVYRON (leitura)*: `get_dashboard_stats`, `get_leads`, `get_clients`, `get_campaigns`, `get_campaign_status`, `get_last_messages`, `get_company`, `get_sales_summary`, `get_reports`
- **Cabeçalho escuro integrado**, seletor de idioma, relógio único
  América/São Paulo e hook compartilhado com guard de sessão.

### `/prospect` — Prospecção

Hub com abas: **Prospecção web**, **Importação manual** e **Grupos do WhatsApp**.

**Aba "Prospecção web"** (fila BullMQ em segundo plano; fonte de descoberta
`PROSPECTOR_PROVIDER`: `firecrawl` (paga) ou `overpass`/`auto` — Overpass API
do OpenStreetMap, gratuita, com fallback automático + Apify como fonte adicional).
**Restrita por plano**: disponível apenas para planos com a feature `prospeccao_web`
habilitada (plano Empresa).

- Card **Nova prospecção**: campos *Segmento/Nicho* (texto livre), *País*, *Estado (UF)*,
  *Cidade*, *Quantidade de leads* (1–500), *Fontes Apify* (`google_maps`, `instagram`),
  select *Adicionar a uma campanha*. Botão **PROSPECTAR**. Valida nicho OU cidade/estado.
- Card **Progresso da prospecção**: barra `salvos/alvo`, stats em tempo real
  (Socket.IO `prospecting_progress` + polling 5s), botão **Cancelar**.
- Card **Resultados**: tabela — *Empresa*, *Telefone* (`tel:`), *E-mail* (`mailto:`),
  *Cidade*, *Estado*, *Site*, *Score* (verde/âmbar/cinza), *Data*.
- Card **Minhas prospecções**: histórico com ações **Atualizar**, **Cancelar**, **Ver**.

**Aba "Importação manual"** (`.csv`/`.xlsx` ou colar texto):

- Card **Importação manual**: botão **Modelo**, alternância **Arquivo** / **Colar texto**,
  dropzone (máx. 5MB), checkbox **Modo teste**, select campanha, botão **Calcular prévia**.
- Card **Prévia**: contadores, tabela com status por linha, botões **Cancelar** e
  **Confirmar importação**.
- Card **Limpar leads importados** (só `OWNER`/`BUSINESS_ADMIN`): botão destrutivo
  que exige digitar `EXCLUIR`.

**Aba "Grupos do WhatsApp"** (feature `whatsapp_group_extraction` — plano Empresa):

- Listagem dos grupos em que a empresa participa (proxy para a sessão Baileys
  do worker).
- Seleção de grupos + destino dos contatos: **leads**, **enriquecer** ou
  **campanha** (campanha nasce `PAUSED`).
- Salvaguardas obrigatórias: checkbox de responsabilidade legal (`confirm_legal`),
  restrição a `OWNER`/`BUSINESS_ADMIN`, feature de plano + assinatura ativa e
  trilha de auditoria. A extração **nunca envia mensagens**.
- Histórico de extrações com progresso, export para campanha e limpeza.

### `/campaigns` — Campanhas

- Botão **Nova campanha** → modal: *Nome*, *Canal* (WhatsApp/E-mail/Ambos),
  *Limite WhatsApp/dia*, *Limite E-mail/dia*, *Intervalo entre envios (s)*,
  *Início diário (horário de Brasília)*, checkbox *Campanha de teste*,
  *Assunto do e-mail* e *Corpo do e-mail* (quando canal inclui EMAIL).
- **Card por campanha** (linka para `/campaigns/[id]`): nome, badge `teste`,
  badge de status, resumo de limites, barra de progresso, countdown do próximo
  envio e stats. Ações por status:
  - `PAUSED` → **Iniciar**
  - `ACTIVE` → **Pausar** · **Encerrar**
  - `FINISHED` → **Reabrir**
  - Sempre → **Excluir** (modal de confirmação; leads importados não são apagados).
- Estado vazio → card com botão **Criar primeira campanha**.

### `/campaigns/[id]` — Detalhe da campanha

- Link **Voltar** → `/campaigns` e ações de status + **Excluir**.
- Badges de status + limites + countdown do próximo envio.
- **6 stat cards**: *Total, Pendentes, Enviados, Respostas, Interessados, Erros*.
- Card **Progresso** (processados vs fila).
- Card **Ajustar limites**: inputs de limites e intervalo + botão **Salvar**.
- Card **Leads da campanha**: tabela *Nome, Empresa, Contato, Canal, Status, Tentativas*.

### `/inbox` — Mensagens (inbox)

- **Filtros** (pílulas): `Respondido` (**padrão**), `Em atendimento`, `Manual`, `Encerradas`.
- Contador de conversas + botão **Limpar tudo** (só `OWNER`/`BUSINESS_ADMIN`).
- **Grid de cards** (`InboxCard`): avatar com gradiente, badge IA/Manual, nome do lead,
  status, telefone formatado, badge de intenção (Alta/Média/Baixa), segmento,
  timestamp relativo, indicador de "nova" (tempo real via Socket.IO).
  Clique abre `/inbox/[id]`; botão de **excluir** individual.

### `/inbox/[id]` — Conversa (chat)

- Header: voltar, avatar, nome do lead, badge **Manual** ou **IA (provedor)**,
  badge Aberta/Encerrada e dados do lead.
- Ações: **Assumir** (modo manual) / **IA** (devolver à IA) / **Encerrar**.
- Bubbles de mensagens estilo WhatsApp (verde=enviada, branca=recebida) com
  animação framer-motion + indicador "digitando…".
- Composer: textarea auto-grow (só editável no modo manual), Enter envia.

### `/clientes` — Clientes

Lista de conversas com leads identificados (cards com dados do cliente,
status e atalho para a conversa).

### `/agenda` — Agenda

Calendário mensal com **2 abas** — **Eventos** e **Lembretes**:

- Criação/edição de eventos: *Título*, datas, dia inteiro, prioridade
  (`LOW`/`NORMAL`/`HIGH`/`URGENT`), recorrência (`NONE`/`DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY`)
  e status (`SCHEDULED`/`CONFIRMED`/`CANCELLED`/`COMPLETED`).
- Lembretes com data/hora e descrição.
- Eventos aparecem como pílulas no calendário (com hora quando não for dia inteiro).
- Mesma base de dados usada pelas ferramentas do agente (`list_calendar_events`,
  `check_event_conflicts`, `find_free_slots`).

### `/financeiro` — Financeiro

Controle financeiro por empresa com receitas/despesas:

- Resumo: totais de **Receitas** e **Despesas**, saldo e projeções.
- Transações: `INCOME`/`EXPENSE`, status `REAL`/`PLANNED`, valor, data,
  categoria e descrição (CRUD completo via `/financial`).
- Categorias customizáveis por empresa.
- Projeções consumíveis pelo agente (`get_financial_summary`,
  `get_financial_projection`, `project_month`…).

### `/emails` — E-mails enviados

- Card de **filtros**: select *Status*, datas *De/Até* + **Atualizar** (refetch 20s).
- Tabela: *Destinatário, Assunto, Data/hora, Status* (badge Enviado/Falhou/Devolvido).

### `/reports` — Relatórios

- Card **Período**: datas *De/Até* + **Atualizar**.
- **Taxas** (4 cards): *Taxa de resposta*, *Taxa de interesse*, *Taxa de conversão*
  (verde), *Taxa de opt-out* (vermelho).
- **Totais** (4 cards): *Enviadas, Respostas, Interessados, Opt-outs*.
- Gráfico de barras **Envios por dia** e linha **Interessados acumulados** (recharts).

### `/settings` — Configurações (Integrações)

- Card **WhatsApp (Baileys)**: badge de status, QR code, botões **Conectar** /
  **Desconectar** / **Limpar sessão** (só `OWNER`/`BUSINESS_ADMIN`).
- Card **Limites e intervalo**: *Limite WhatsApp/dia*, *Limite E-mail/dia*,
  *Intervalo entre envios (s)* — valores padrão para novas campanhas.
- Card **Parada de emergência**: botão vermelho **Pausar todas as campanhas**.

### `/settings/empresa-ia` — Empresa + IA (página unificada)

Página que combina configurações da empresa e configurações da IA em um único lugar.

**Seção "Identificação da empresa":**
- Card **Dados**: *Nome da empresa*, *Segmento*, *Telefone*, *E-mail*, *CNPJ*, *Descrição*.
- Card **Presença**: *Endereço*, *Site*, *Horário*, *Fuso horário*, *Logo (URL)*.

**Seção "Contexto da empresa" (usado pela IA):**
- Card **Contexto**: *Público-alvo*, *Problemas resolvidos*, *Diferenciais*,
  *Posicionamento*, *Área de atendimento*, *Objetivos do negócio*,
  *Instruções adicionais*.

**Seção "Configuração do agente IA":**
- Card **Identidade**: *Nome*, *Função*, *Descrição*, *Objetivo*, *Modo* (vendas/suporte/ambos).
- Card **Tom de voz**: chips (Profissional, Amigável, Casual, Descontraído, Premium, Consultivo, Técnico).
- Card **Comportamento**: 9 checkboxes (ser natural, evitar robótico, fazer perguntas, identificar necessidade, tentar converter, oferecer produtos/serviços, tentar agendar, encaminhar para humano, usar emojis).
- Card **Mensagens**: *Tamanho máximo*, *Máximo de frases*, *Mensagens por resposta*, *Máximo de emojis*.
- Card **Prompt personalizado**: textarea (limite 20.000 chars) + link **Guia de prompts**.
- Botão **Salvar**.

### `/settings/plano` — Meu plano

- Card **Plano atual**: nome, valor, período, data de vencimento/próxima cobrança.
- Card **Histórico de pagamentos**: tabela com data, valor, status, método.
- Botão **Gerenciar assinatura** (redireciona ao portal do gateway).

### `/ai/knowledge` — Base de conhecimento

- Card de criação/edição: *Título*, *Categoria* (Produtos, Serviços, Planos, Preços, Promoções, Horários, Dias, Pagamento, Endereço, FAQ, Políticas, Benefícios, Regras comerciais, Links, Regras internas), *Conteúdo*, *Palavras-chave*.
- Lista de itens: título, badge de categoria, badge `inativo`, ações **Ativar/Desativar**, **editar**, **excluir**.

### `/ai/playground` — Testar IA

- Aviso se nenhum provedor estiver configurado.
- Card **Envie uma mensagem de teste** + **Gerar resposta**.
- Card **Resposta da IA**: mensagem enviada, resposta, nome do agente.

### `/ai/prompt-guide` — Guia de prompts

Guia para gerar o prompt do agente com o ChatGPT: 8 passos, template copiável
com descrição completa do negócio (5 blocos), exemplos reais preenchidos
(SAVYRON, Barbearia Imperial), checklist antes de publicar e regra de ouro.

---

## Painel administrativo (`/admin`)

Acesso restrito a `PLATFORM_ADMIN`/`PLATFORM_STAFF`. Sidebar própria com
navegação e link **Voltar ao painel**. Suporta **impersonation** (modo suporte):
o admin entra como uma empresa sem saber a senha (auditado) e um banner âmbar
oferece **Sair do modo de suporte** → `/admin/impersonate/exit`.

| Rota | Conteúdo / cards / botões |
|---|---|
| `/admin` | **Dashboard da plataforma**: cards *MRR* (+ nº de assinaturas), *ARR*, *Receita do mês*, *Receita total*, *Empresas* (ativas), *Ativos*, *Trial*, *Canceladas* (com % churn), *Assinaturas vencidas*, *Pagamentos pendentes*; bloco **Uso da IA** (*Contatos, Conversas, Mensagens, Gerações*). |
| `/admin/businesses` | Lista de empresas: busca + card por empresa com status e contadores. Botões **Suspender**, **Reativar**, **Cancelar** e **Suporte** (impersonação auditada). |
| `/admin/plans` | Cards de plano (preço, features, badge ativo/inativo) + **Editar**; botão **Novo plano** com form completo. |
| `/admin/subscriptions` | Lista de assinaturas + modal de detalhe: troca de plano, **Cancelar**/**Reativar**, histórico de pagamentos. |
| `/admin/payments` | Filtros + card por pagamento (método, valor, status, gateway) + **Reconciliar**. |
| `/admin/users` | Botão **Novo usuário** + lista com badge de papel. Modal: *Papel na plataforma*, *Status*, *Empresas do usuário*. |
| `/admin/usage` | Filtros + cards de totais + tabela de consumo por empresa. |
| `/admin/audit` | Trilha de auditoria: filtro por *ação*, paginação **Carregar mais** (50/página). |
| `/admin/settings` | Configurações globais (chave/valor): form + **Salvar**, por item **Editar**/**Remover**. |

---

## API (rotas principais)

Todas as rotas abaixo são montadas na API Express (porta 4005) e prefixadas
por `API_BASE_URL`. O dashboard chama a API através do proxy local
`/api/proxy/[...path]` com o token da sessão — o navegador nunca expõe o
`API_TOKEN`.

| Área | Prefixo | Endpoints |
|---|---|---|
| Saúde | `/health` | `GET /` |
| Auth | `/auth` | `POST /login` · `POST /logout` · `POST /change-password` · `GET /me` · `GET /businesses` · `POST /select-business` |
| Onboarding | `/auth` | `GET /plans` · `POST /send-code` · `POST /verify-code` · `POST /signup` |
| Prospecção web | `/leads` | `POST /leads/prospect` · `GET /leads/prospections` · `GET /leads/prospections/:id` · `GET /leads/prospections/:id/leads` · `POST /leads/prospections/:id/cancel` · `DELETE /leads/prospections/:id` |
| Importação | `/leads` | `POST /leads/import/preview` · `POST /leads/import/confirm` · `GET /leads/imports` · `GET /leads/imported/count` · `DELETE /leads/imported` · `GET /leads` · `GET /leads/:id` |
| Grupos WhatsApp | `/whatsapp/groups` | `GET /list` · `POST /extract` · `GET /extractions` · `GET /extractions/:id` · `POST /extractions/:id/export-to-campaign` · `GET /extractions/:id/leads` · `DELETE /extractions/:id/leads` · `DELETE /extractions/:id` |
| Campanhas | `/campaigns` | `POST /` · `GET /` · `POST /pause-all` · `GET /:id` · `PATCH /:id` · `GET /:id/leads` · `GET /:id/stats` · `POST /:id/start` · `POST /:id/pause` · `POST /:id/resume` · `POST /:id/finish` · `DELETE /:id` |
| Dashboard | `/dashboard` | `GET /metrics` · `GET /settings` · `PUT /settings` |
| Inbox | `/conversations` | `GET /` (filtro) · `GET /:id` · `POST /:id/takeover` · `POST /:id/release` · `POST /:id/message` · `POST /:id/close` · `DELETE /` (limpar tudo) · `DELETE /:id` |
| Clientes | `/clients` | `GET /` (lista de conversas com leads que têm nome) |
| Relatórios | `/reports` | `GET /?from&to` |
| WhatsApp | `/whatsapp` | `GET /status` · `GET /qr` · `POST /connect` · `POST /disconnect` · `POST /clear-session` |
| E-mails | `/emails` | `GET /?status&from&to` |
| Notificações | `/notifications` | `GET /` · `PATCH /:id/read` · `POST /read-all` |
| Empresa | `/business` | `GET /settings` · `PATCH /settings` |
| IA | `/ai` | `GET/POST /agents` · `PATCH/DELETE /agents/:id` · `GET/PATCH /settings` · `GET/POST /knowledge` · `PATCH/DELETE /knowledge/:id` · `GET /playground/status` · `POST /playground` |
| **Agente de voz** | `/agent` | `POST /chat` (transcrição + histórico → resposta com ferramentas) · `POST /transcribe` (STT Groq Whisper) · `POST /tts` (Kokoro WAV, fallback navegador) · `GET /capabilities` |
| **Agenda** | `/calendar` | `GET/POST /events` · `PUT/DELETE /events/:id` · `GET/POST /reminders` · `PUT/DELETE /reminders/:id` |
| **Financeiro** | `/financial` | `GET/POST /categories` · `GET/POST /transactions` · `PUT/DELETE /transactions/:id` · `GET /summary` |
| **Memória** | `/memory` | `GET /` · `POST /` · `DELETE /:id` · `GET /search` |
| Billing | `/billing` | `GET /status` · `POST /checkout` · `POST /activate-free` |
| Admin | `/admin` | `GET /dashboard` · `GET/POST /businesses` · `GET/PATCH /businesses/:id` · `POST /businesses/:id/status` · `GET/POST /plans` · `PATCH /plans/:id` · `GET /subscriptions` · `GET /subscriptions/:id` · `POST /subscriptions/:id/change-plan` · `POST /subscriptions/:id/cancel` · `POST /subscriptions/:id/reactivate` · `GET /payments` · `POST /payments/:id/reconcile` · `GET /usage` · `GET /audit` · `GET/POST /users` · `GET/PATCH /users/:id` · `GET /support-sessions` · `POST /impersonate` · `POST /impersonate/exit` · `GET/PATCH /settings` · `DELETE /settings/:key` |
| Webhooks | `/webhooks` | `POST /stripe` · `POST /cakto` · `POST /abacatepay` · `POST /resend` · `POST /whatsapp` |

---

## Motor comercial e IA

### Pipeline de IA

```
Mensagem recebida → Fila message-received → Classificador de intenção
    → Fila ai-response → Montador de prompt (6 camadas) → LLM (NVIDIA NIM → Groq → OpenRouter)
    → Motor comercial → Validação → Envio
```

**Camadas de prompt** (`services/ai/src/prompt-assembler.ts`):
1. **SYSTEM** — regras da plataforma (opt-out, anti-spam, tom)
2. **GLOBAL** — configurações globais do sistema
3. **AGENT** — identidade e comportamento do agente
4. **BUSINESS** — contexto da empresa (público-alvo, diferenciais, posicionamento)
5. **KNOWLEDGE** — base de conhecimento categorizada (produtos, preços, horários…)
6. **CLIENT** — contexto da conversa (stage, memória, dados do lead)

### Motor comercial (`services/ai/src/commercial-engine.ts`)

9 técnicas éticas de vendas aplicadas dinamicamente:
- Construção de rapport · Qualificação BANT · Apresentação de valor
- Criação de urgência · Tratamento de objeções · Prova social
- Fechamento · Cross-sell · Agendamento

O motor rastreia o **estágio da conversa** (`ConversationStage`):
`NEW` → `QUALIFYING` → `DISCOVERY` → `EVALUATION` → `NEGOTIATION` → `CLOSED_WON` / `CLOSED_LOST`

- **Decision Engine** orientado a intenção/próximo passo — conversa humana,
  análise e geração isoladas (sem vazamento de raciocínio no reply).
- **Conversation Memory** persistente + Context Recovery (resumo da conversa,
  objetivo atual, próximo passo, perguntas já feitas).

### Classificação de intenção (`services/ai/src/classifier.ts`)

Classifica mensagens como: `INTERESTED`, `NOT_INTERESTED`, `QUESTION`, `OPT_OUT`,
`BUSY`, `GREETING`, `IRRELEVANT`. Opt-out é detectado mesmo sem IA (heurística
por palavras-chave).

### Provedores de IA

| Provedor | Modelo | Papel |
|---|---|---|
| **NVIDIA NIM** (primary) | `moonshotai/kimi-k3` | Análise e geração via API |
| **Groq** (fallback 1) | `llama-3.1-8b-instant` | Fallback + STT (Whisper) |
| **OpenRouter** (fallback 2) | `nvidia/nemotron-3-super-120b-a12b:free` | Fallback gratuito |
| **OpenAI** (alternativa) | `gpt-4o-mini` | Disponível como opção |

Rotação automática em caso de falha/quota (`services/ai/src/provider-manager.ts`
e `apps/api/src/services/api-keys.ts`).

### Aprendizado de conversas

O worker `conversation-learning` analisa conversas finalizadas e gera:
- **SalesConversationInsight** — dados por conversa (pains, objections, needs, técnicas usadas, outcome)
- **CommercialStrategy** — estratégias aprendidas por segmento/canal com confidence score
  (amostras mínimas, continuidade mínima e confiança mínima para ativar uso automático)

---

## Fontes de dados da prospecção e enriquecimento

O campo **Segmento / Nicho** é texto livre — funciona para **qualquer**
segmento digitado ("loja de roupas", "escritório de advocacia", "academia de
crossfit"…), não só os exemplos do placeholder.

- **Firecrawl** (paga, chave `FIRECRAWL_API_KEY`): crawleia sites para extrair contatos.
- **Overpass API / OpenStreetMap** (gratuita, sem chave): alternativa por
  categoria + localização. Mapeamento amplo (dezenas de categorias) com
  correspondência fuzzy (acentos/caixa/plurais/typos). Geocoding via Nominatim.
- **Apify** (chave `APIFY_API_TOKEN`): scraping multi-fonte — Google Maps,
  Instagram, com deduplicação cruzada entre fontes.
- **Grupos do WhatsApp** (Baileys): extração de contatos de grupos com
  salvaguardas legais (ver aba "Grupos do WhatsApp" em `/prospect`).
- **Seleção** (`PROSPECTOR_PROVIDER`): `firecrawl`, `overpass`, `apify`, `auto` (padrão).
- **Enriquecimento (Scrapy)**: visita sites institucionais e extrai e-mail,
  telefone e WhatsApp (respeitando `robots.txt`).
- **Deduplicação**: prioridade telefone > e-mail > id externo > nome+telefone.

---

## Billing (planos, assinaturas e pagamentos)

- **Planos** (`Plan`/`PlanFeature`) gerenciados em `/admin/plans` e expostos
  em `/vitrine` e `/signup`. Features incluem `prospeccao_web` e
  `whatsapp_group_extraction` (plano Empresa).
- **Assinatura** criada no signup com status `PENDING_PAYMENT`; empresa vira
  `ACTIVE` após pagamento.
- **Gateways** (ordem de preferência):
  - **AbacatePay** (PIX manual, gateway atual) — quando configurado.
  - **Cakto** (PIX recorrente) — quando configurado.
  - **Stripe** (PIX + cartão via `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID`).
  - Planos gratuitos usam `POST /billing/activate-free`.
- **Webhooks** (`/webhooks/abacatepay`, `/webhooks/stripe`, `/webhooks/cakto`)
  atualizam pagamento, assinatura e status da empresa (com dedup de eventos).

---

## Agente de voz (MAICON) — arquitetura

```
Mic → VAD adaptativo (Web Audio) → MediaRecorder (webm)
    → POST /agent/transcribe (Groq Whisper)
    → POST /agent/chat (JARVIS: LLM + ferramentas somente-leitura)
    → POST /agent/tts (Kokoro self-hosted, WAV) → Speaker
    (fallback: voz nativa do navegador em quota/erro)
```

- **TTS Kokoro self-hosted**: `KOKORO_URL` (padrão `http://localhost:8000`),
  voz `pm_alex`, normalização de texto para TTS (`tts-normalizer.ts`).
- **Ferramentas somente-leitura**: bloqueio em 3 camadas — declaração
  (`READONLY_TOOLS`), filtro por nome (`isWriteToolName`) e execução
  (`executeReadonlyTool`). O agente consulta leads, clientes, campanhas,
  financeiro, agenda e memória, mas **nunca** altera dados.
- **Núcleo visual MAICON V2**: orbitais, partículas e boca sincronizada com o
  loop de fala; tema futurista escopado; 100% da tela sem header branco.

---

## Início rápido (desenvolvimento)

```bash
# 1. Ambiente
cp .env.example .env           # preencha as chaves (Neon, Redis, NVIDIA/Groq, Resend…)
docker compose up -d           # Redis local (opcional; já existe um rodando na VPS)

# 2. Dependências + Prisma
npm install
npm run db:generate
npm run db:migrate             # aplica migrações
npm run db:seed                # cria admin e configurações padrão

# 3. Build dos pacotes e serviços
npm run build:packages

# 4. Rodar os 3 serviços (em terminais separados)
npm run dev:api
npm run dev:worker
npm run dev:dashboard

# 5. (Opcional) TTS do agente de voz — Kokoro self-hosted
# Suba o serviço Kokoro em http://localhost:8000 (KOKORO_URL)
```

Acesso padrão (primeiro acesso **obriga troca de senha**):

```
E-mail: ceo.inovapro@maicon
Senha:  Inovapro$2026
```

## Configuração (variáveis de ambiente)

Copie `.env.example` para `.env`. O pacote `@prospector/config`
(`packages/config/src/index.ts`) lê tudo a partir da raiz do monorepo.
Variáveis **obrigatórias**: `DATABASE_URL`, `SESSION_SECRET` e `API_TOKEN`.

| Grupo | Variáveis principais | Obrigatória | Observações |
|---|---|---|---|
| Banco | `DATABASE_URL` (Neon PostgreSQL) | sim | `sslmode=require` |
| Redis | `REDIS_URL` | — | padrão `redis://localhost:6379` |
| IA | `NVIDIA_API_KEY`, `NVIDIA_MODEL` (moonshotai/kimi-k3), `NVIDIA_BASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_MESSAGE_LENGTH` | — | NVIDIA NIM primário; Groq e OpenRouter como fallback |
| TTS (agente) | `KOKORO_URL`, `KOKORO_VOICE`, `KOKORO_LANG`, `KOKORO_SPEED`, `KOKORO_TIMEOUT_MS` | — | Kokoro self-hosted (WAV) |
| E-mail | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_FROM_NAME` | — | — |
| Pagamentos | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_METHOD_CONFIGURATION_ID` | — | Checkout Stripe (PIX + cartão) |
| Pagamentos (Cakto) | `CAKTO_CLIENT_ID`, `CAKTO_CLIENT_SECRET`, `CAKTO_WEBHOOK_SECRET`, `CAKTO_API_BASE_URL` | — | PIX recorrente |
| Pagamentos (AbacatePay) | `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`, `ABACATEPAY_WEBHOOK_ENDPOINT`, `ABACATEPAY_API_BASE_URL` | — | PIX manual (gateway atual) |
| Prospecção web | `PROSPECTOR_PROVIDER` (`firecrawl`/`overpass`/`apify`/`auto`), `FIRECRAWL_API_KEY`, `FIRECRAWL_API_BASE_URL`, `PROSPECTOR_*` | — | `auto`: Firecrawl → Overpass |
| Apify | `APIFY_API_TOKEN`, `APIFY_*` | — | Google Maps, Instagram, multi-fonte |
| Overpass/OSM | `OVERPASS_API_URL`, `OVERPASS_TIMEOUT_MS`, `OVERPASS_RETRY_ATTEMPTS`, `NOMINATIM_API_URL` | — | Fonte gratuita (OpenStreetMap) |
| Enriquecimento | `SCRAPY_SERVICE_URL`, `SCRAPY_CONCURRENCY`, `SCRAPY_REQUEST_DELAY_MS`, `SCRAPY_SERVICE_PORT` | — | Serviço Python Scrapy (PM2) |
| WhatsApp | `WHATSAPP_SESSION_PATH` | — | Sessão Baileys no servidor |
| Agente V2 | `SAVYRON_AGENT_CORE_V2` | — | `false` faz rollback do núcleo visual V2 |
| App | `SESSION_SECRET`, `API_TOKEN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_APP_URL`, `API_BASE_URL`, `DASHBOARD_URL` | `SESSION_SECRET` + `API_TOKEN` | `ADMIN_*` usados pelo seed |
| Campanha | `DEFAULT_WHATSAPP_DAILY_LIMIT` (30), `DEFAULT_EMAIL_DAILY_LIMIT` (100), `DEFAULT_INTERVAL_SECONDS` (7200), `TEST_MODE_MAX_LEADS` (5) | — | defaults em segundos |
| Tempo real | `NEXT_PUBLIC_SOCKET_URL` | — | vazio em produção (nginx proxy); `http://localhost:4005` em dev |
| Portas | `DASHBOARD_PORT` (3005), `API_PORT` (4005), `WORKER_PORT` (5005) | — | — |
| Segurança | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | — | rate limit global por IP |

## Deploy (produção)

```bash
bash scripts/deploy.sh          # instala, migra, seed, build e sobe via PM2
pm2 save                        # salva a lista de processos
pm2 startup                     # habilita o auto-start no boot
```

Arquivos importantes:

- `ecosystem.config.js` — quatro processos: `prospector-dashboard`, `prospector-api`, `prospector-worker` e `prospector-scrapy`, cada um com `max_memory_restart: 512M`.
- `nginx/crm.inovapro.cloud.conf` — proxy reverso + SSL (copiar para `/etc/nginx/sites-available/`).
- `scripts/setup-ssl.sh` — emite/renova o certificado Let's Encrypt.

O domínio `crm.inovapro.cloud` → dashboard (3005). `/api/*` passa pelo
dashboard (proxy de dados para API 4005 com token da sessão).
`/api/webhooks/*` e `/socket.io/*` vão direto para a API.

## Operação e manutenção

### Processos e logs (PM2)

```bash
pm2 status                  # estado dos processos
pm2 logs prospector-api     # acompanhar logs em tempo real
pm2 logs --lines 500        # últimas 500 linhas
pm2 restart prospector-worker   # reiniciar um serviço
```

| Processo | stdout | stderr |
|---|---|---|
| dashboard | `logs/dashboard.out.log` | `logs/dashboard.err.log` |
| api | `logs/api.out.log` | `logs/api.err.log` |
| worker | `logs/worker.out.log` | `logs/worker.err.log` |
| scrapy | `logs/scrapy.out.log` | `logs/scrapy.err.log` |

### Verificação de saúde

```bash
curl http://localhost:4005/health
# → { success: true, service: 'api', version, env, uptime,
#     dependencies: { database: 'ok', redis: 'checked-at-runtime' } }
```

### Scripts utilitários

| Script | Função |
|---|---|
| `npm run build` | Build completo (pacotes + API + worker + dashboard) |
| `npm run typecheck` | TypeScript em todo o monorepo |
| `npm run lint` | ESLint |
| `npm test` | ~550 subtests (node --test, 51 arquivos) |
| `node scripts/clean-db.mjs` | **Zera todos os dados** e limpa filas Redis. Preserva User, Setting e sessão WhatsApp. |
| `node scripts/generate-sample-leads.js 1000 data/sample-leads.csv` | Gera leads fictícios para validar importação |
| `node scripts/generate-pwa-icons.mjs` | Regenera ícones PWA em `public/icons/` |
| `bash scripts/setup-ssl.sh` | Emite/renova certificado Let's Encrypt |

### Troubleshooting

- **WhatsApp desconectado / sem QR**: `/settings` → "Conectar WhatsApp" → escaneie o QR.
- **Mensagens enfileiradas mas não saem**: verifique Redis e worker (`pm2 status`).
- **Campanha não envia**: se houver `start_hour`, envios só acontecem na janela de Brasília.
- **Lead sempre em `ERROR`**: fila `dead-letter` após 3 tentativas (ver log).
- **Prospecção web falha**: confira `PROSPECTOR_PROVIDER` e a chave correspondente.
- **Enriquecimento não roda**: confira `prospector-scrapy` (`pm2 status`).
- **Empresa travada em PENDING_PAYMENT**: verifique `/admin/payments` → **Reconciliar**.
- **Extração de grupos bloqueada**: requer plano Empresa (feature `whatsapp_group_extraction`) + assinatura ativa + papel OWNER/ADMIN.
- **Agente sem voz**: verifique Kokoro (`KOKORO_URL`) para TTS e `GROQ_API_KEY` para STT; fallback automático para voz do navegador.
- **Agente em modo errado**: `SAVYRON_AGENT_CORE_V2=false` volta ao AgentTab V1.

## Tempo real (WebSocket) e PWA

### Arquitetura do tempo real

```
dashboard (browser) ──Socket.IO──► nginx /socket.io/ ──► API (4005)
                                       ▲                          │
            worker ──Redis pub/sub─────┴───────────► Socket.IO ──┘
```

- **Worker** publica eventos Redis (`realtime:events`): `new_message_received`,
  `ai_response_generated`, `status_changed`, `prospecting_progress`.
- **API** assina e retransmite via **Socket.IO** (autenticação JWT no handshake).
- **Dashboard** mantém **conexão singleton** (`lib/socket-client.ts`) —
  reconexão automática + banner offline.

### PWA (instalável e offline)

- `app/manifest.ts` → `manifest.webmanifest` (tema dark, ícones 192/512/maskable).
- `public/sw.js` → Service Worker (cache de assets, network-first para navegação e `/api/proxy/*`).
- `components/pwa/service-worker-register.tsx` → registro automático em produção.
- Inbox funciona offline com último estado carregado.

## Segurança

- Sessão por JWT (HS256) em cookie `httpOnly` + `Secure`; troca de senha obrigatória no 1º acesso.
- Auth com verificação de e-mail (código de 6 dígitos, uso único) no signup.
- Papéis na empresa e na plataforma; ações destrutivas restritas a `OWNER`/`BUSINESS_ADMIN`.
- Todas as rotas do dashboard protegidas por middleware; `/admin/*` requer `PLATFORM_ADMIN`/`PLATFORM_STAFF`.
- Rate limiting por IP na API (exceto webhooks); uploads limitados a 5MB.
- Proxy local com `API_TOKEN` — o navegador nunca expõe o token da API.
- Impersonation auditada (cada sessão de suporte fica registrada).
- Extração de grupos do WhatsApp com confirmação legal + auditoria; nunca envia mensagens.
- Agente de voz em modo somente-leitura (bloqueio de ferramentas de escrita em 3 camadas).
- Chaves de API com rotação e marcação de quota esgotada (`api-keys.ts`).
- Sessão WhatsApp persistida apenas no servidor.
- Logs estruturados com trilha de auditoria completa.

## Testes

```bash
npm test
```

~550 subtests (51 arquivos) cobrindo: normalização de telefone/e-mail, parser
CSV, deduplicação, modo teste, detecção de opt-out, motor comercial, campanhas,
billing (Stripe/Cakto/AbacatePay), prospecção (Firecrawl/Overpass/Apify),
extração de grupos WhatsApp, IA (provedores, modos, prompt), agente de voz
(VAD, datetime, readonly, mobile nav, visual state), conversas, enriquecimento,
admin (acesso, política, segurança, exclusão), e mais.

## Dados de exemplo

```bash
node scripts/generate-sample-leads.js 1000 data/sample-leads.csv
```

---

> **Prospecção responsável:** o sistema respeita limites diários e de plataforma.
> Não burla CAPTCHA nem limites do WhatsApp/Resend. A extração de grupos do
> WhatsApp exige confirmação legal explícita e nunca envia mensagens.
