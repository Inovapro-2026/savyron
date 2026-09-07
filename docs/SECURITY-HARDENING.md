# SAVYRON — Security Hardening Playbook

> **Data:** 2026-09-07
> **Versão:** 1.0
> **Ambiente:** Produção — crm.inovapro.cloud

---

## ANTES vs DEPOIS

| Severidade  | ANTES | DEPOIS |
|-------------|-------|--------|
| CRITICAL    | 2     | 0      |
| HIGH        | 5     | 0      |
| MEDIUM      | 5     | 0      |
| LOW         | 2     | 1      |
| INFO        | 1     | 1      |

---

## Fix 1 — Default-Deny Middleware (CRITICAL: VULN-001)
**Arquivo:** apps/dashboard/middleware.ts
Invertido para Default-Deny: toda rota exige acp_token JWT válido.
Exceções explícitas apenas para PUBLIC_PATHS (/login, /signup, /vitrine) e assets estáticos.
SESSION_SECRET ausente em produção provoca falha fatal (throw).

## Fix 2 — Defense-in-Depth no Layout (CRITICAL: VULN-001)
**Arquivo:** apps/dashboard/app/(dashboard)/layout.tsx
Adicionada verificação server-side: if (!session || !session.sub) redirect('/login');

## Fix 3 — Verificação de Token ao Criar Cookie (HIGH: VULN-002)
**Arquivo:** apps/dashboard/app/api/auth/session/set/route.ts
verifySession(body.token) valida assinatura HMAC e expiração antes de definir o cookie.

## Fix 4 — Binding de Rede 127.0.0.1 (HIGH: VULN-003)
**Arquivos:** apps/api/src/index.ts, apps/worker/src/server.ts, services/scrapy/server.py
Express (4005), Worker (5005) e Scrapy (6810) agora fazem bind apenas em 127.0.0.1.

## Fix 5 — Trust Proxy (MEDIUM: VULN-004)
**Arquivo:** apps/api/src/app.ts
app.set("trust proxy", 1) — req.ip agora retorna o IP real do cliente via Nginx.

## Fix 6 — Headers de Segurança Next.js (MEDIUM: VULN-005)
**Arquivo:** apps/dashboard/next.config.mjs
poweredByHeader: false + X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

## Fix 7 — Verificação Webhook Resend (HIGH: VULN-006)
**Arquivo:** apps/api/src/routes/webhooks.ts
Se RESEND_WEBHOOK_SECRET configurado: verifica HMAC-SHA256. Payload inválido → 401.

## Fix 8 — Restrição Webhook WhatsApp (MEDIUM: VULN-007)
**Arquivo:** apps/api/src/routes/webhooks.ts
Exige x-worker-token (ou Authorization Bearer) se WORKER_SECRET_TOKEN configurado.
Sem token configurado: aceita apenas loopback (127.0.0.1/::1).

## Fix 9 — Rate Limiting em Auth (HIGH: VULN-008)
**Arquivo:** apps/api/src/routes/auth.ts
- POST /auth/login: 10 req/min
- POST /auth/send-code: 5 req/5min
- POST /auth/verify-code: 10 req/5min
- POST /auth/signup: 5 req/15min
- POST /auth/change-password: 5 req/5min

## Fix 10 — IDOR: PUT /dashboard/settings (HIGH: VULN-009)
**Arquivo:** apps/api/src/routes/dashboard.ts
requireRole(['OWNER', 'BUSINESS_ADMIN']) adicionado antes do handler.

## Fix 11 — IDOR: DELETE /leads/prospections/:id (HIGH: VULN-010)
**Arquivo:** apps/api/src/routes/prospecting.ts
requireRole(['OWNER', 'BUSINESS_ADMIN']) adicionado antes do handler.

## Fix 12 — Socket.IO Cross-Tenant Leak (CRITICAL: VULN-011)
**Arquivo:** apps/api/src/services/realtime.ts
Eventos sem businessId são descartados com warning. Nunca mais io.emit() global.

## Fix 13 — Upload Filter OR→AND (MEDIUM: VULN-012)
**Arquivo:** apps/api/src/middleware/upload.ts
ALLOWED_EXTENSIONS.includes(ext) && mimeOk — ambos devem ser válidos.

## Fix 14 — Nginx Hardening (MEDIUM: VULN-013)
**Arquivo:** /etc/nginx/sites-available/crm.inovapro.cloud
- server_tokens off
- Strict-Transport-Security (HSTS 1 ano + preload)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
- Bloqueia dotfiles (exceto .well-known)
- Bloqueia .env, .git, .bak, .sql, .log, .sh, .swp, .orig

---

## Risco Residual

| ID | Descrição | Severidade |
|----|-----------|------------|
| RES-001 | Rate limiting em memória (não Redis) — zeros no restart | LOW |
| RES-002 | Webhook WhatsApp loopback-only sem token configurado | LOW |
