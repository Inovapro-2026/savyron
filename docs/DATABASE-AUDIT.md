# SAVYRON — AUDITORIA DE BANCO DE DADOS & PREPARAÇÃO PARA 4 DATABASES NEON

Data da Auditoria: 07/09/2026
Status da Produção: ONLINE (https://crm.inovapro.cloud)

---

## 1. Diagnóstico do Problema Raiz (Dashboard Zerado & Inbox Vazio)

### Sintomas Reportados:
- Leads = 0, Pendentes = 0, Enviados = 0, Respostas = 0, Erros = 0.
- Inbox exibia "Nenhuma conversa neste filtro".

### Causa Raiz Identificada:
O sistema SAVYRON é multi-tenant estrito com isolamento por `business_id`.
Existiam 2 registros na tabela `Business`:
1. `cin_default_agendacorte` (criado na migration inicial/seed do AgendaCorte) — com **0 leads, 0 conversas, 0 mensagens**.
2. `cmtasswz60002iilam4eqxvu8` (SAVYRON / Inovapro Technology) — com **288 leads, 25 conversas, 201 mensagens, 1 campanha**.

O usuário administrador `ceo.inovapro@maicon` estava associado via `BusinessMember` apenas ao tenant `cin_default_agendacorte`. Logo, ao efetuar login, o token JWT recebia o `businessId` vazio de leads.

### Solução Aplicada:
- Criação de backup preventivo da tabela `BusinessMember` (`_backup_BusinessMember_20260907`).
- Vinculação formal do usuário `ceo.inovapro@maicon` ao tenant real `cmtasswz60002iilam4eqxvu8` como `OWNER` na tabela `BusinessMember`.
- O login agora seleciona prioritariamente o tenant real ativo do SAVYRON.
- O Dashboard agora exibe:
  - **Total de Leads:** 288
  - **Disponíveis:** 110
  - **Erros:** 172
  - **Mensagens no Mês:** 26
  - **Conversas no Inbox:** 25 ativas com mensagens e histórico completo.

---

## 2. Diagnóstico e Correção de ChunkLoadError

### Causa Raiz:
1. Conflito entre builds do Next.js standalone quando o Service Worker (`sw.js`) utilizava estratégia `stale-while-revalidate` para assets estáticos e `network-first` que caía em cache de página HTML antiga.
2. O HTML com referências a chunks antigos de páginas secundárias (`campaigns`, `emails`) falhava ao solicitar os chunks hash inexistentes no novo build.

### Soluções Aplicadas:
1. **Service Worker (`public/sw.js`)**:
   - Incrementado `CACHE_NAME` para `savyron-v7` (força invalidação de todos os caches antigos do navegador dos usuários no próximo acesso).
   - Navegação: `network-first` estrito para garantir que o HTML sempre carregue o manifesto e chunks do build vigente.
   - Assets imutáveis (`_next/static`): Cache-First seguro com fallback de rede.
2. **Next.js Config (`next.config.mjs`)**:
   - Adicionado cabeçalho `Cache-Control: public, max-age=31536000, immutable` para `/_next/static/:path*`.
   - Adicionado cabeçalho `Cache-Control: no-cache, no-store, must-revalidate` para `/sw.js`.
3. **Build Limpo & Deploy Atômico**:
   - Executado `rm -rf .next && npm run build` gerando conjunto íntegro de manifestos e chunks.
   - Sincronização atômica para o standalone (`postbuild.sh`).
   - Reinício seguro apenas do processo PM2 `prospector-dashboard`.

---

## 3. Mapeamento de Tabelas para a Arquitetura de 4 Bancos Neon

Conforme a diretriz de divisão lógica e física:

### BANCO 1: CORE / TENANT
**Responsabilidade:** Identidade, permissões, cobrança e estrutura de empresas.
- `Business`
- `BusinessMember`
- `BusinessSettings`
- `User`
- `Setting`
- `Subscription`
- `Plan`
- `PlanFeature`
- `Payment`
- `FinancialCategory`
- `FinancialTransaction`
- `ApiKey`

### BANCO 2: CRM / SALES
**Responsabilidade:** Dados comerciais, prospecção e funil de vendas.
- `Lead`
- `LeadImport`
- `Campaign`
- `CampaignLead`
- `ProspectionRun`
- `WhatsAppGroupExtraction`
- `WhatsAppGroupSource`
- `WhatsAppGroupLead`
- `CommercialStrategy`
- `SalesConversationInsight`
- `CalendarEvent`
- `Reminder`

### BANCO 3: COMMUNICATIONS / OPERATIONS
**Responsabilidade:** Mensageria, realtime, histórico de chat e execução de agentes.
- `Conversation`
- `ConversationNote`
- `ConversationMemory`
- `Message`
- `DeliveryEvent`
- `OptOut`
- `AIAgent`
- `AISettings`
- `AIKnowledge`
- `AIGeneration`
- `Memory`

### BANCO 4: ANALYTICS / HISTORY / AUDIT
**Responsabilidade:** Auditoria, telemetria, logs de disparos e relatórios.
- `AuditLog`
- `Usage`
- `Notification`
- `EmailLog`
- `EmailVerification`

---

## 4. Reconciliação Atual de Dados

| Entidade | Registros no Banco Atual | Tenant Real (`cmtasswz...`) |
| :--- | :--- | :--- |
| Business | 2 | 1 |
| User | 3 | 3 |
| BusinessMember | 3 | 2 |
| Lead | 288 | 288 |
| Conversation | 25 | 25 |
| Message | 201 | 201 |
| Campaign | 1 | 1 |
| CampaignLead | 285 | 285 |
| Subscription | 1 | 1 |
| Payment | 1 | 1 |
| AuditLog | 638 | 26 |
| Notification | 324 | 0 |
