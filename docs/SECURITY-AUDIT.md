# MEGA AUDITORIA DE SEGURANÇA — SAVYRON

**Data da Auditoria:** 07 de Setembro de 2026  
**Status Geral:** AUDITORIA CONCLUÍDA — MAPA DE VULNERABILIDADES IDENTIFICADAS  
**Alvo:** SAVYRON Commercial Platform (`apps/dashboard`, `apps/api`, `apps/worker`, `services`, `packages`, Nginx, PM2, Redis, PostgreSQL)  

---

## 1. RESUMO EXECUTIVO

Foi realizada uma auditoria completa de segurança no código-fonte, arquitetura de rede, isolamento multi-tenant, autenticação, autorização, websockets, webhooks, filas, agente de IA e configuração de infraestrutura do sistema SAVYRON.

Durante o mapeamento aprofundado, identificou-se a causa-raiz exata da falha reportada em produção referente ao acesso não autenticado a `/agente`, além de brechas similares nas rotas `/agenda`, `/financeiro` e `/emails`. Adicionalmente, foram identificadas vulnerabilidades críticas e de alta severidade na camada de rede (serviços internos escutando em `0.0.0.0` com firewall inativo), na identificação de IP no Express (ausência de `trust proxy` gerando rate limiting compartilhado), validação de webhooks e privilégios de endpoints da API.

### Sumário de Severidades (Fase de Auditoria):
- **CRITICAL:** 2
- **HIGH:** 5
- **MEDIUM:** 5
- **LOW:** 2
- **INFO:** 1
- **TOTAL:** 15 vulnerabilidades mapeadas

---

## 2. DETALHAMENTO DAS VULNERABILIDADES

---

### [VULN-001] Bypassing de Autenticação em Rotas Protegidas (/agente, /agenda, /financeiro, /emails) no Middleware Next.js
- **Severidade:** CRITICAL
- **Arquivo:** `apps/dashboard/middleware.ts`
- **Linhas:** 7, 12-14, 34-36
- **Causa:** O array `PROTECTED_PREFIXES` continha apenas rotas listadas manualmente (`/dashboard`, `/lead-import`, `/prospect`, `/campaigns`, `/inbox`, `/clientes`, `/reports`, `/settings`, `/change-password`, `/payment`, `/admin`, `/ai`). As rotas `/agente`, `/agenda`, `/financeiro` e `/emails` foram omitidas da lista. Na linha 34, a regra `if (isAsset || (!isProtected && !isPublic)) return NextResponse.next();` permitia a passagem transparente para o Next.js renderizar a página sem checar sessão ou token.
- **Impacto:** Qualquer usuário anônimo na internet pode carregar diretamente as páginas `/agente`, `/agenda`, `/financeiro` e `/emails`, visualizando toda a interface comercial, layouts e componentes React sem efetuar login.
- **Exploração Possível:** Requisição direta via browser ou curl: `GET https://crm.inovapro.cloud/agente` sem cookie de sessão. O servidor responde HTTP 200 OK com o HTML completo renderizado.
- **Correção Recomendada:** Inverter a lógica do middleware para *Default-Deny*: considerar todas as rotas protegidas por padrão, exceto as declaradas estritamente em `PUBLIC_PATHS` (`/login`, `/signup`, `/vitrine`, além de assets estáticos `_next` e favicon).
- **Status:** OPEN

---

### [VULN-002] Ausência de Verificação Server-Side de Sessão no Layout do Dashboard
- **Severidade:** CRITICAL
- **Arquivo:** `apps/dashboard/app/(dashboard)/layout.tsx`
- **Linha:** 8-24
- **Causa:** O Server Component `DashboardGroupLayout` chamava `const session = await getSession();`, porém utilizava o resultado exclusivamente para exibir uma barra de impersonação. Não havia qualquer condicional redirecionando requisições sem sessão válida (`redirect('/login')`).
- **Impacto:** Quebra do princípio de Defesa em Profundidade. Caso o middleware falhe ou uma nova rota seja criada sob o grupo `(dashboard)`, os Server Components de todas as páginas filhas eram renderizados pelo servidor e enviados ao cliente mesmo sem autenticação.
- **Exploração Possível:** Acesso direto a qualquer página filha do grupo `(dashboard)` quando não interceptada pelo middleware.
- **Correção Recomendada:** Adicionar verificação explícita no layout do servidor: se `!session || !session.sub`, disparar `redirect('/login')` imediatamente antes de renderizar qualquer conteúdo filho.
- **Status:** OPEN

---

### [VULN-003] Exposição Externa de Serviços Internos (API:4005, Worker:5005, Scrapy:6810) por Binding em 0.0.0.0 com Firewall Inativo
- **Severidade:** HIGH
- **Arquivo:** `apps/api/src/index.ts:16`, `apps/worker/src/server.ts:132`, `services/scrapy/server.py:116`
- **Linha:** Várias (chamadas `app.listen(port)` e `ThreadingHTTPServer(("0.0.0.0", PORT), Handler)`)
- **Causa:** Os serviços HTTP da API (4005), Worker Control Server (5005) e Scrapy Python (6810) escutavam na interface `0.0.0.0` (todas as interfaces de rede). A verificação do firewall do sistema revelou `ufw status: inactive`. Em particular, o serviço Scrapy na porta 6810 não possui autenticação.
- **Impacto:** Um atacante externo pode contornar completamente o Nginx, certificados SSL, rate limiting e regras de proxy, conectando-se diretamente às portas 4005, 5005 e 6810. Na porta 6810, pode disparar raspagens arbitrárias (SSRF e consumo de recursos).
- **Exploração Possível:** Requisição TCP externa direta para `http://<IP_DO_SERVIDOR>:6810/enrich` ou `http://<IP_DO_SERVIDOR>:4005/health`.
- **Correção Recomendada:** Vincular estritamente os serviços internos ao loopback local `127.0.0.1` (`app.listen(port, '127.0.0.1')` e `ThreadingHTTPServer(("127.0.0.1", PORT), Handler)`).
- **Status:** OPEN

---

### [VULN-004] Ausência de 'trust proxy' no Express Resultando em Rate Limiting Compartilhado e Logs com IP Falso
- **Severidade:** HIGH
- **Arquivo:** `apps/api/src/app.ts`
- **Linha:** 35-76
- **Causa:** O Express opera atrás do proxy reverso Nginx, mas a configuração `app.set('trust proxy', 1)` não foi habilitada. Consequentemente, `req.ip` no Express sempre avaliava como `127.0.0.1` (o endereço de loopback do Nginx).
- **Impacto:** 
  1. O middleware de rate limiting (`rateLimit`) agrupa requisições por `${ip}:${req.path}`. Como todos os usuários apareciam com IP `127.0.0.1`, todos os clientes reais da plataforma compartilhavam o mesmo contador global. Se um cliente exceder a cota, todos os demais usuários são bloqueados (Denial of Service).
  2. Todos os logs de auditoria e segurança registravam `127.0.0.1` em vez do IP real do atacante.
- **Exploração Possível:** Um único atacante enviando requisições em rajada esgota o bucket `127.0.0.1` e causa negação de serviço em todos os usuários legítimos da aplicação.
- **Correção Recomendada:** Configurar `app.set('trust proxy', 1);` no Express em `apps/api/src/app.ts`.
- **Status:** OPEN

---

### [VULN-005] Webhook do Resend Sem Validação de Assinatura Criptográfica
- **Severidade:** HIGH
- **Arquivo:** `apps/api/src/routes/webhooks.ts`
- **Linha:** 434-468
- **Causa:** A rota `POST /webhooks/resend` recebia payloads de eventos de e-mail e gravava diretamente em `prisma.deliveryEvent.create` além de enfileirar no BullMQ sem verificar cabeçalhos de assinatura ou secret. O helper `verifyResendSignature` existe em `@prospector/email`, mas nunca era chamado na rota da API.
- **Impacto:** Qualquer agente malicioso na internet pode forjar notificações de bounce, complaint ou entrega de e-mails, manipulando métricas analíticas e status de contatos.
- **Exploração Possível:** Envio de `POST /api/webhooks/resend` com payload arbitrário forjando falha ou bounce de campanhas comerciais.
- **Correção Recomendada:** Exigir validação de assinatura HMAC do Resend (`svix-signature` ou secret de webhook) antes de aceitar e processar o payload.
- **Status:** OPEN

---

### [VULN-006] Ausência de Rate Limiting Rigoroso em Endpoints Críticos de Autenticação (Risco de Força Bruta)
- **Severidade:** HIGH
- **Arquivo:** `apps/api/src/routes/auth.ts`
- **Linha:** 63-151, 331-352
- **Causa:** Os endpoints `/auth/login`, `/auth/send-code` e `/auth/verify-code` estavam sujeitos apenas ao rate limit global genérico (120 req/min).
- **Impacto:** Permite ataques automatizados de força bruta contra senhas de usuários e enumeração/ataque de dicionário contra códigos OTP de 6 dígitos enviados por e-mail no cadastro.
- **Exploração Possível:** Script automatizado tentando milhares de senhas ou códigos OTP a uma taxa de 2 requisições por segundo sem bloqueio preventivo.
- **Correção Recomendada:** Implementar limitadores específicos para `/auth/login` (ex.: máx 10 tentativas por IP por minuto) e `/auth/send-code` / `/auth/verify-code` (máx 5 tentativas por janela).
- **Status:** OPEN

---

### [VULN-007] Injeção de Cookie de Sessão Sem Validação Prévia de Assinatura JWT em /api/auth/session/set
- **Severidade:** HIGH
- **Arquivo:** `apps/dashboard/app/api/auth/session/set/route.ts`
- **Linha:** 8-20
- **Causa:** O endpoint `POST /api/auth/session/set` gravava o valor recebido no body (`body.token`) diretamente no cookie HttpOnly `acp_token` sem validar se o token era um JWT íntegro, assinado pelo `SESSION_SECRET` e dentro do prazo de validade.
- **Impacto:** Possibilidade de fixação de sessão ou contaminação de cookies com strings inválidas ou forjadas.
- **Exploração Possível:** Requisição para `/api/auth/session/set` com token forjado.
- **Correção Recomendada:** Executar `await verifySession(body.token)` dentro do Route Handler antes de chamar `setSessionOnResponse`. Rejeitar com 401/400 se o token for nulo, inválido ou expirado.
- **Status:** OPEN

---

### [VULN-008] Broken Access Control / Escalação de Privilégios: Membro Não-Admin Pode Alterar Limites Comerciais
- **Severidade:** MEDIUM
- **Arquivo:** `apps/api/src/routes/dashboard.ts`
- **Linha:** 40-55
- **Causa:** A rota `PUT /dashboard/settings` permitia atualizar `whatsapp_daily_limit`, `email_daily_limit` e `interval_seconds` exigindo apenas `requireAuth` e `requireBusiness`, sem exigir papel administrativo (`requireRole(['OWNER', 'BUSINESS_ADMIN'])`), ao contrário de `business.ts`.
- **Impacto:** Qualquer membro da empresa com perfil operacional (`AGENT` ou `MANAGER`) conseguia alterar parâmetros críticos de disparo da empresa.
- **Exploração Possível:** Usuário autenticado como AGENT envia `PUT /dashboard/settings` alterando o intervalo de envios e limites.
- **Correção Recomendada:** Adicionar `requireRole(['OWNER', 'BUSINESS_ADMIN'])` na rota `PUT /dashboard/settings`.
- **Status:** OPEN

---

### [VULN-009] Broken Access Control: Membro Operacional Pode Excluir Runs de Prospecção e Leads Coletados
- **Severidade:** MEDIUM
- **Arquivo:** `apps/api/src/routes/prospecting.ts`
- **Linha:** 320-384
- **Causa:** O endpoint `DELETE /leads/prospections/:id` exclui em cascata uma extração de prospecção inteira, seus leads coletados, conversas e mensagens sem checar se o usuário possui papel `OWNER` ou `BUSINESS_ADMIN`.
- **Impacto:** Um operador (`AGENT`) insatisfeito ou comprometido pode expurgar centenas de leads minerados da empresa.
- **Exploração Possível:** Usuário AGENT emite `DELETE /leads/prospections/<id>` e destrói o histórico de prospecção.
- **Correção Recomendada:** Adicionar `requireRole(['OWNER', 'BUSINESS_ADMIN'])` na rota `DELETE /leads/prospections/:id`.
- **Status:** OPEN

---

### [VULN-010] Risco de Vazamento Multi-Tenant em Eventos Socket.IO Sem businessId
- **Severidade:** MEDIUM
- **Arquivo:** `apps/api/src/services/realtime.ts`
- **Linha:** 158-166
- **Causa:** No método `broadcast(event)`, se `event.businessId` não estiver presente ou for vazio, a função executava `this.io.emit(event.type, event)`, transmitindo a mensagem para TODAS as salas e conexões conectadas no servidor, sem isolamento por tenant.
- **Impacto:** Caso qualquer job do worker ou rota interna emita um evento com payload de conversa ou lead sem preencher `businessId`, o evento é vazado para clientes de outras empresas.
- **Exploração Possível:** Escuta no websocket por eventos globais broadcasted acidentalmente.
- **Correção Recomendada:** Descartar ou registrar log de aviso para eventos recebidos sem `businessId`, proibindo a retransmissão aberta para todos os sockets.
- **Status:** OPEN

---

### [VULN-011] Ausência de Headers de Segurança HTTP e Proteção de Arquivos Ocultos no Nginx
- **Severidade:** MEDIUM
- **Arquivo:** `/etc/nginx/sites-available/crm.inovapro.cloud` e `nginx/crm.inovapro.cloud.conf`
- **Linhas:** 18-80
- **Causa:** O bloco do servidor Nginx não incluía cabeçalhos recomendados pela OWASP (`X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`), mantinha `server_tokens` ativado e não bloqueava requisições diretas a arquivos ocultos (`.env`, `.git`, backups, etc.).
- **Impacto:** Divulgação de versões, suscetibilidade a MIME sniffing e risco de exposição acidental de arquivos de configuração caso colocados em diretórios servidos.
- **Exploração Possível:** Enumeração de headers e tentativas de requisição para `/.env` e `/.git`.
- **Correção Recomendada:** Inserir headers de segurança modernos no bloco HTTPS do Nginx, desativar `server_tokens` e bloquear explicitamente acesso a arquivos que iniciem com ponto ou extensões sensíveis.
- **Status:** OPEN

---

### [VULN-012] Divulgação de Tecnologia no Next.js (X-Powered-By) e Headers Parciais
- **Severidade:** MEDIUM
- **Arquivo:** `apps/dashboard/next.config.mjs`
- **Linhas:** 5-12
- **Causa:** `next.config.mjs` apenas definia `X-Frame-Options: DENY` e mantinha o cabeçalho `X-Powered-By: Next.js` habilitado por padrão.
- **Impacto:** Identificação facilitada de frameworks e versões por scanners automatizados.
- **Exploração Possível:** Análise dos headers HTTP de qualquer resposta.
- **Correção Recomendada:** Configurar `poweredByHeader: false` e adicionar headers complementares de segurança no Next.js.
- **Status:** OPEN

---

### [VULN-013] Segredos de Fallback em Código e Variáveis Opcionais
- **Severidade:** LOW
- **Arquivo:** `apps/dashboard/middleware.ts:4`, `packages/config/src/index.ts:134-135`
- **Causa:** `middleware.ts` utilizava `'dev-secret'` como fallback se `SESSION_SECRET` não estivesse presente nas variáveis de ambiente. `packages/config` continha credenciais padrão hardcoded para admin (`adminPassword: optional("ADMIN_PASSWORD", "Inovapro$2026")`).
- **Impacto:** Caso as variáveis de ambiente falhem em carregar no processo do dashboard, sessões poderiam ser forjadas usando o segredo padrão.
- **Exploração Possível:** Criação de JWT forjado assinado com `'dev-secret'` caso a variável de ambiente estivesse ausente.
- **Correção Recomendada:** Exigir `SESSION_SECRET` estritamente em produção (erro fatal se ausente), removendo o fallback inseguro. Remover senha padrão hardcoded.
- **Status:** OPEN

---

### [VULN-014] Validação de Upload com Condicional Permissiva (OR em vez de AND)
- **Severidade:** LOW
- **Arquivo:** `apps/api/src/middleware/upload.ts`
- **Linha:** 14-16
- **Causa:** A expressão `if (ALLOWED_EXTENSIONS.includes(ext) || mimeOk)` utilizava um operador disjuntivo (`||`). Um arquivo com qualquer extensão executável (`.sh`, `.bin`, `.exe`) enviado com cabeçalho falso `Content-Type: text/plain` passava pelo filtro do multer.
- **Impacto:** Embora o arquivo seja mantido em memória e parseado como texto de planilha, a filtragem permissiva é contrária às boas práticas de validação de entrada (Defense in Depth).
- **Exploração Possível:** Upload de arquivos de tipos não suportados com MIME spoofing.
- **Correção Recomendada:** Modificar a condicional para exigir extensão permitida E MIME compatível simultaneamente.
- **Status:** OPEN

---

### [VULN-015] Execução de Processos PM2 Sob Usuário Root
- **Severidade:** INFO
- **Arquivo:** `ecosystem.config.js` / VPS Process Table
- **Causa:** O daemon do PM2 e os processos Node.js e Python executam sob a conta `root`.
- **Impacto:** Na eventualidade de uma exploração de execução remota de código em alguma biblioteca de terceiros, o atacante obtém diretamente o controle total do sistema operacional.
- **Correção Recomendada:** Planejar a migração da execução dos processos de aplicação para um usuário dedicado sem privilégios de superusuário (ex.: `savyron`).
- **Status:** OPEN

---

## 3. AUDITORIA DE DEPENDÊNCIAS (NPM AUDIT)

A execução de `npm audit --omit=dev` identificou 6 vulnerabilidades conhecidas em pacotes:
1. `next` (0.9.9 - 16.3.0-preview.10) — DoS em Server Actions / Cache Key / SSRF. Severidade: Critical/High.
2. `postcss` (<=8.5.22) — Dependência indireta do Next.js. Severidade: High.
3. `qs` (2.2.5 - 6.15.3) — DoS via array-limit em body-parser/express. Severidade: Moderate.
4. `xlsx` — Prototype Pollution / ReDoS no SheetJS. Severidade: High.

*Recomendação:* Não executar `npm audit fix --force` em produção de maneira cega, pois Next.js 16 introduz breaking changes. Mitigar os riscos nas camadas de aplicação e Nginx e aplicar correções seguras.

---

## 4. AUDITORIA DE SEGREDOS E GIT

- O repositório possui arquivo `.gitignore` com regras para `.env`, `session/` (sessões Baileys WhatsApp) e `backups/`.
- Verificação de histórico: nenhum arquivo `.env` com segredos de produção foi comitado no git (apenas `.env.example`).
- Nenhum segredo em texto claro foi exportado no relatório conforme as instruções.
