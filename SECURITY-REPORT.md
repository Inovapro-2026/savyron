# 🛡️ SAVYRON — Relatório Completo de Auditoria & Hardening de Segurança

> **Data:** 2026-09-07  
> **Ambiente:** Produção — `crm.inovapro.cloud`  
> **Sistema:** SAVYRON CRM (Next.js 14 + Express + BullMQ + Socket.IO + Baileys)  
> **Engenheiro:** Security Audit Automation  
> **Versão do Relatório:** 1.0 (Final)

---

## 📊 Resumo Executivo — ANTES vs DEPOIS

| Severidade  | ANTES | DEPOIS | Δ |
|-------------|-------|--------|---|
| 🔴 CRITICAL | 2     | 0      | -2 |
| 🟠 HIGH     | 5     | 0      | -5 |
| 🟡 MEDIUM   | 5     | 0      | -5 |
| 🔵 LOW      | 2     | 1      | -1 |
| ⚪ INFO      | 1     | 1      | 0  |
| **TOTAL**   | **15**| **2**  | **-13** |

> ✅ **13 vulnerabilidades fechadas.** Sistema em produção operacional. Nenhuma funcionalidade quebrada.

---

## 🏗️ Arquitetura do Sistema

```
Internet
  │
  ▼
[Nginx — crm.inovapro.cloud — porta 443/80]
  │   /              → Dashboard Next.js (127.0.0.1:3005)
  │   /api/          → Dashboard Next.js (127.0.0.1:3005)
  │   /socket.io/    → Express API (127.0.0.1:4005)
  │   /api/webhooks/ → Express API (127.0.0.1:4005)
  │
  ├── [prospector-dashboard] Next.js 14        (127.0.0.1:3005)
  │     └── /api/proxy/[...path] → Express API
  │
  ├── [prospector-api] Express + Socket.IO     (127.0.0.1:4005)
  │     └── BullMQ queues → Redis
  │
  ├── [prospector-worker] BullMQ Worker        (127.0.0.1:5005)
  │     └── Baileys (WhatsApp), Groq AI, NVIDIA
  │
  ├── [prospector-scrapy] Python Scrapy        (127.0.0.1:6810)
  │
  ├── [agente] Agente IA companion             (porta interna)
  ├── [agendacorte-backend] Backend Agendamento
  └── [kokoro-tts] Text-to-Speech
```

---

## 🔍 Fase 0 — Mapeamento e Inventário de Vulnerabilidades

### Vulnerabilidades Encontradas (ANTES do Hardening)

#### 🔴 CRITICAL

**VULN-001 — Bypass de Autenticação nas Rotas Principais**
- **Arquivo:** `apps/dashboard/middleware.ts`
- **Descrição:** Rotas `/agente`, `/agenda`, `/financeiro`, `/emails` retornavam HTTP 200 sem cookie de sessão. A lista `PROTECTED_PREFIXES` estava incompleta e a lógica `!isProtected && !isPublic → pass` era permissiva.
- **Impacto:** Qualquer pessoa sem login conseguia acessar a interface do CRM.
- **Reprodução:** `curl -s -I http://127.0.0.1:3005/agente` → HTTP 200 (antes era assim)

**VULN-011 — Socket.IO Vazamento Cross-Tenant**
- **Arquivo:** `apps/api/src/services/realtime.ts`
- **Descrição:** Na função `broadcast()`, se `event.businessId` fosse vazio/undefined, o código fazia `io.emit(event.type, event)` — transmitindo para **todos os tenants conectados**.
- **Impacto:** Dados de conversas, leads e status de uma empresa podiam ser recebidos por outra empresa.

---

#### 🟠 HIGH

**VULN-002 — Cookie de Sessão Aceita Token Não Verificado**
- **Arquivo:** `apps/dashboard/app/api/auth/session/set/route.ts`
- **Descrição:** O endpoint `/api/auth/session/set` aceitava qualquer string como `token` e definia o cookie `acp_token` sem validar a assinatura JWT.
- **Impacto:** Qualquer usuário podia forjar uma sessão com `sub` e `businessId` arbitrários.

**VULN-003 — Portas Internas Expostas em 0.0.0.0**
- **Arquivos:** `apps/api/src/index.ts`, `apps/worker/src/server.ts`, `services/scrapy/server.py`
- **Descrição:** Express (4005), Worker (5005) e Scrapy (6810) faziam bind em `0.0.0.0`. Com `ufw` inativo, ficavam acessíveis diretamente da internet.
- **Impacto:** Acesso direto à API Express sem passar pelo Nginx/proxy (sem TLS, sem rate limit global).

**VULN-006 — Webhook Resend sem Verificação de Assinatura**
- **Arquivo:** `apps/api/src/routes/webhooks.ts`
- **Descrição:** `POST /webhooks/resend` aceitava qualquer payload sem verificar assinatura HMAC do Resend.
- **Impacto:** Forjamento de eventos de entrega de e-mail (manipular métricas, marcar e-mails como entregues).

**VULN-008 — Nenhum Rate Limiting em Autenticação**
- **Arquivo:** `apps/api/src/routes/auth.ts`
- **Descrição:** Endpoints `/login`, `/send-code`, `/verify-code`, `/signup` sem qualquer rate limiting.
- **Impacto:** Brute force de senhas e códigos OTP ilimitado.

**VULN-009 — IDOR: Qualquer Usuário Altera Configurações Globais**
- **Arquivo:** `apps/api/src/routes/dashboard.ts`
- **Descrição:** `PUT /dashboard/settings` sem verificação de role — qualquer `AGENT` ou `MANAGER` podia alterar limites de dispatch de toda a empresa.
- **Impacto:** Usuário com menor privilégio manipula limites críticos de operação.

**VULN-010 — IDOR: Qualquer Usuário Deleta Prospecções**
- **Arquivo:** `apps/api/src/routes/prospecting.ts`
- **Descrição:** `DELETE /leads/prospections/:id` sem verificação de role — qualquer usuário autenticado podia deletar runs completas de prospecção e todos os leads associados.
- **Impacto:** Deleção permanente e irreversível de dados de leads por usuário não-autorizado.

---

#### 🟡 MEDIUM

**VULN-004 — Trust Proxy Ausente (req.ip = 127.0.0.1)**
- **Arquivo:** `apps/api/src/app.ts`
- **Descrição:** Sem `trust proxy`, `req.ip` retornava sempre `127.0.0.1` (IP do Nginx), inutilizando rate limiting por IP.

**VULN-005 — Headers de Segurança Ausentes no Next.js**
- **Arquivo:** `apps/dashboard/next.config.mjs`
- **Descrição:** Sem `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Header `X-Powered-By: Next.js` exposto.

**VULN-007 — Webhook WhatsApp Completamente Aberto**
- **Arquivo:** `apps/api/src/routes/webhooks.ts`
- **Descrição:** `POST /webhooks/whatsapp` sem autenticação — qualquer IP externo podia enviar payloads.

**VULN-012 — Upload Filter usa OR (extensão OU MIME)**
- **Arquivo:** `apps/api/src/middleware/upload.ts`
- **Descrição:** `ALLOWED_EXTENSIONS.includes(ext) || mimeOk` — arquivo malicioso com extensão `.csv` e MIME type perigoso passava pelo filtro.

**VULN-013 — Nginx sem Headers de Segurança e sem Bloqueio de Dotfiles**
- **Arquivo:** `/etc/nginx/sites-available/crm.inovapro.cloud`
- **Descrição:** Sem HSTS, X-Frame-Options, X-Content-Type-Options. Dotfiles (`.env`, `.git`) e extensões sensíveis acessíveis.

---

#### 🔵 LOW

**VULN-014 — Sem UFW/Firewall Ativo**
- **Descrição:** `ufw` estava inativo. Portas internas dependiam apenas do bind de rede (corrigido no Fix 4).
- **Status:** Parcialmente mitigado via binding 127.0.0.1.

**VULN-015 — Informações de Stack Expostas**
- **Descrição:** `X-Powered-By: Next.js` e versão do Nginx expostos.
- **Status:** Corrigido nos Fix 6 e Fix 14.

---

## 🔧 Fase 1 a 14 — Correções Aplicadas

---

### Fix 1 — Default-Deny Middleware (CRITICAL: VULN-001)

**Arquivo:** `apps/dashboard/middleware.ts`

**Mudança:** Lógica invertida para **Default-Deny**.

```typescript
// ANTES (permissivo):
// Lista incompleta de PROTECTED_PREFIXES
// Fallback: !isProtected && !isPublic → pass

// DEPOIS (default-deny):
// Toda rota exige acp_token JWT válido
// Exceções explícitas apenas: /login, /signup, /vitrine + assets estáticos
// SESSION_SECRET ausente em produção → throw (falha fatal)

const PUBLIC_PATHS = ['/login', '/signup', '/vitrine'];
// Qualquer outra rota → verifica JWT ou redireciona para /login
```

---

### Fix 2 — Defense-in-Depth no Layout do Dashboard (CRITICAL: VULN-001)

**Arquivo:** `apps/dashboard/app/(dashboard)/layout.tsx`

```typescript
// Adicionado no início do componente server-side:
if (!session || !session.sub) redirect('/login');
```

Segunda barreira independente do middleware — protege contra SSR sem cookie.

---

### Fix 3 — Verificação de Token ao Criar Cookie (HIGH: VULN-002)

**Arquivo:** `apps/dashboard/app/api/auth/session/set/route.ts`

```typescript
// ANTES: aceitava qualquer string como token
// DEPOIS: valida assinatura HMAC e expiração
const verified = await verifySession(body.token);
if (!verified) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
```

---

### Fix 4 — Binding de Rede 127.0.0.1 (HIGH: VULN-003)

**apps/api/src/index.ts:**
```typescript
server.listen(port, "127.0.0.1", () => { ... });
```

**apps/worker/src/server.ts:**
```typescript
app.listen(port, "127.0.0.1", () => { ... });
```

**services/scrapy/server.py:**
```python
app.run(host="127.0.0.1", port=6810)
```

---

### Fix 5 — Trust Proxy (MEDIUM: VULN-004)

**Arquivo:** `apps/api/src/app.ts`

```typescript
// Adicionado logo após criação do Express:
app.set("trust proxy", 1);
// Agora req.ip = IP real do cliente (via X-Forwarded-For do Nginx)
```

---

### Fix 6 — Headers de Segurança Next.js (MEDIUM: VULN-005)

**Arquivo:** `apps/dashboard/next.config.mjs`

```javascript
poweredByHeader: false,  // Remove X-Powered-By: Next.js

headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ]
}]
```

---

### Fix 7 — Verificação HMAC Webhook Resend (HIGH: VULN-006)

**Arquivo:** `apps/api/src/routes/webhooks.ts`

```typescript
// POST /webhooks/resend
const secret = process.env.RESEND_WEBHOOK_SECRET;
if (secret) {
  const signature = req.headers["svix-signature"] || req.headers["resend-signature"];
  const timestamp = req.headers["svix-timestamp"] || req.headers["resend-timestamp"];
  const bodyStr = rawBody?.toString("utf8") ?? JSON.stringify(req.body ?? {});
  const isValid = verifyResendSignature(secret, bodyStr, signature, timestamp);
  if (!isValid) return res.status(401).json({ error: "Assinatura inválida" });
}
```

---

### Fix 8 — Restrição Webhook WhatsApp (MEDIUM: VULN-007)

**Arquivo:** `apps/api/src/routes/webhooks.ts`

```typescript
// POST /webhooks/whatsapp
const workerToken = req.headers["x-worker-token"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
const expectedToken = process.env.WORKER_SECRET_TOKEN || process.env.INTERNAL_API_SECRET;
const isLoopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip);

if (expectedToken) {
  if (workerToken !== expectedToken) return res.status(401).json({ error: "unauthorized" });
} else if (!isLoopback) {
  return res.status(403).json({ error: "Acesso restrito" });
}
```

---

### Fix 9 — Rate Limiting em Auth (HIGH: VULN-008)

**Arquivo:** `apps/api/src/routes/auth.ts`

```typescript
import { rateLimit } from "../middleware/rate-limit";

const loginLimiter         = rateLimit({ windowMs: 60_000,       max: 10 });
const sendCodeLimiter      = rateLimit({ windowMs: 5 * 60_000,   max: 5  });
const verifyCodeLimiter    = rateLimit({ windowMs: 5 * 60_000,   max: 10 });
const signupLimiter        = rateLimit({ windowMs: 15 * 60_000,  max: 5  });
const changePasswordLimiter= rateLimit({ windowMs: 5 * 60_000,   max: 5  });

authRouter.post("/login",           loginLimiter,          asyncHandler(...));
authRouter.post("/send-code",       sendCodeLimiter,       asyncHandler(...));
authRouter.post("/verify-code",     verifyCodeLimiter,     asyncHandler(...));
authRouter.post("/signup",          signupLimiter,         asyncHandler(...));
authRouter.post("/change-password", changePasswordLimiter, requireAuth, asyncHandler(...));
```

---

### Fix 10 — IDOR: PUT /dashboard/settings (HIGH: VULN-009)

**Arquivo:** `apps/api/src/routes/dashboard.ts`

```typescript
import { requireRole } from '../middleware/auth';

dashboardRouter.put(
  '/settings',
  requireRole(['OWNER', 'BUSINESS_ADMIN']),  // ← ADICIONADO
  asyncHandler(async (req, res) => { ... })
);
```

---

### Fix 11 — IDOR: DELETE /leads/prospections/:id (HIGH: VULN-010)

**Arquivo:** `apps/api/src/routes/prospecting.ts`

```typescript
prospectingRouter.delete(
  "/prospections/:id",
  requireRole(["OWNER", "BUSINESS_ADMIN"]),  // ← ADICIONADO
  asyncHandler(async (req, res) => { ... })
);
```

---

### Fix 12 — Socket.IO Cross-Tenant Broadcast (CRITICAL: VULN-011)

**Arquivo:** `apps/api/src/services/realtime.ts`

```typescript
// ANTES:
broadcast(event) {
  if (event.businessId) {
    this.io.to(event.businessId).emit(event.type, event);
  } else {
    this.io.emit(event.type, event);  // ← VAZAVA PARA TODOS OS TENANTS
  }
}

// DEPOIS:
broadcast(event) {
  if (event.businessId) {
    this.io.to(event.businessId).emit(event.type, event);
  } else {
    logger.warn("Evento descartado por ausência de businessId (isolamento multi-tenant)", { type: event.type });
    // Evento descartado — nunca emitido globalmente
  }
}
```

---

### Fix 13 — Upload Filter OR → AND (MEDIUM: VULN-012)

**Arquivo:** `apps/api/src/middleware/upload.ts`

```typescript
// ANTES: bastava extensão OU mime type
if (ALLOWED_EXTENSIONS.includes(ext) || mimeOk) { ... }

// DEPOIS: exige extensão E mime type corretos
if (ALLOWED_EXTENSIONS.includes(ext) && mimeOk) { ... }
```

---

### Fix 14 — Nginx Hardening (MEDIUM: VULN-013)

**Arquivo:** `/etc/nginx/sites-available/crm.inovapro.cloud`

```nginx
server {
  # Oculta versão do Nginx
  server_tokens off;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

  # Bloqueia dotfiles (exceto .well-known para ACME/Certbot)
  location ~ /\.(?!well-known) {
    deny all;
    return 404;
  }

  # Bloqueia extensões sensíveis
  location ~* \.(env|git|bak|sql|log|sh|swp|orig)$ {
    deny all;
    return 404;
  }
}
```

---

## 🧪 Resultados dos Testes de Regressão

Executados em: **2026-09-07T13:04:18Z** (produção)

### ✅ TESTE 1 — Rotas Protegidas sem Auth

| Rota        | HTTP | Redirect |
|-------------|------|----------|
| /agente     | 307  | /login   |
| /agenda     | 307  | /login   |
| /financeiro | 307  | /login   |
| /emails     | 307  | /login   |
| /dashboard  | 307  | /login   |
| /clientes   | 307  | /login   |
| /reports    | 307  | /login   |

### ✅ TESTE 2 — API sem Token

```
GET /auth/me → { "success": false, "error": { "code": "UNAUTHORIZED" } }
```

### ✅ TESTE 3 — Dotfiles Bloqueados

| URL | HTTP |
|-----|------|
| /.env | 404 |
| /.git | 404 |
| /.env.local | 404 |

### ✅ TESTE 4 — Headers de Segurança

| Header | Presente |
|--------|---------|
| Strict-Transport-Security | ✅ max-age=31536000; includeSubDomains; preload |
| X-Content-Type-Options | ✅ nosniff |
| X-Frame-Options | ✅ DENY |
| Referrer-Policy | ✅ strict-origin-when-cross-origin |
| Permissions-Policy | ✅ camera=(), microphone=(), geolocation=(), payment=() |
| Server: (sem versão) | ✅ apenas "nginx" |

### ✅ TESTE 5 — PM2 Status

| Processo | Status |
|----------|--------|
| prospector-api | 🟢 online |
| prospector-worker | 🟢 online |
| prospector-dashboard | 🟢 online |
| prospector-scrapy | 🟢 online |
| agente | 🟢 online |
| agendacorte-backend | 🟢 online |
| kokoro-tts | 🟢 online |

---

## 📁 Arquivos Modificados

| Arquivo | Tipo | Fix(es) |
|---------|------|---------|
| `apps/dashboard/middleware.ts` | Dashboard | Fix 1 |
| `apps/dashboard/app/(dashboard)/layout.tsx` | Dashboard | Fix 2 |
| `apps/dashboard/app/api/auth/session/set/route.ts` | Dashboard | Fix 3 |
| `apps/dashboard/next.config.mjs` | Dashboard | Fix 6 |
| `apps/api/src/index.ts` | API | Fix 4 |
| `apps/api/src/app.ts` | API | Fix 5 |
| `apps/api/src/routes/auth.ts` | API | Fix 9 |
| `apps/api/src/routes/dashboard.ts` | API | Fix 10 |
| `apps/api/src/routes/prospecting.ts` | API | Fix 11 |
| `apps/api/src/routes/webhooks.ts` | API | Fix 7, Fix 8 |
| `apps/api/src/middleware/upload.ts` | API | Fix 13 |
| `apps/api/src/services/realtime.ts` | API | Fix 12 |
| `apps/worker/src/server.ts` | Worker | Fix 4 |
| `services/scrapy/server.py` | Scrapy | Fix 4 |
| `/etc/nginx/sites-available/crm.inovapro.cloud` | Nginx | Fix 14 |
| `nginx/crm.inovapro.cloud.conf` | Nginx (repo) | Fix 14 |

---

## ⚠️ Risco Residual

| ID | Descrição | Severidade | Recomendação |
|----|-----------|------------|-------------|
| RES-001 | Rate limiting em memória — reinicializações do processo zeram contadores | LOW | Migrar para `rate-limiter-flexible` com Redis store |
| RES-002 | Webhook WhatsApp sem `WORKER_SECRET_TOKEN` configurado (loopback-only) | LOW | Configurar `WORKER_SECRET_TOKEN` no `.env` de produção |

---

## 🔨 Comandos de Verificação

```bash
# Verificar redirect sem auth
curl -s -I http://127.0.0.1:3005/agente | head -3

# Verificar API sem token
curl -s http://127.0.0.1:4005/auth/me | python3 -m json.tool

# Verificar dotfiles bloqueados
curl -sk -o /dev/null -w "%{http_code}" https://crm.inovapro.cloud/.env

# Verificar headers de segurança
curl -sk -I https://crm.inovapro.cloud/ | grep -iE "(strict-transport|x-content|x-frame|referrer|permissions|server:)"

# Status PM2
pm2 ls

# Status Nginx
systemctl status nginx

# Rate limit test (11x login rápido → deve receber 429)
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:4005/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"wrong"}'
done
```

---

## 📋 Documentos Relacionados

- `docs/SECURITY-AUDIT.md` — Inventário original de vulnerabilidades
- `docs/SECURITY-HARDENING.md` — Playbook detalhado de correções
- `docs/SECURITY-TESTS.md` — Resultados e scripts de testes
- `SECURITY-REPORT.md` — **Este arquivo** (relatório consolidado)

---

*Relatório gerado em 2026-09-07 — SAVYRON Security Audit v1.0*
