# SAVYRON — Security Test Results

> **Data:** 2026-09-07
> **Versão:** 1.0
> **Ambiente:** Produção — crm.inovapro.cloud

---

## Resultados dos Testes de Regressão

### TESTE 1: Rotas Protegidas sem Auth — ✅ PASSOU

Todas as rotas de dashboard redirecionam para /login (HTTP 307) sem cookie de sessão.

| Rota        | Código | Redirecionamento |
|-------------|--------|-----------------|
| /agente     | 307    | /login          |
| /agenda     | 307    | /login          |
| /financeiro | 307    | /login          |
| /emails     | 307    | /login          |
| /dashboard  | 307    | /login          |
| /clientes   | 307    | /login          |
| /reports    | 307    | /login          |

**Reprodução:**
```bash
curl -s -I http://127.0.0.1:3005/agente | head -3
# Esperado: HTTP/1.1 307 Temporary Redirect
# Location: /login
```

---

### TESTE 2: API sem Token — ✅ PASSOU

`GET /auth/me` sem `Authorization` header retorna `{ success: false, error: { code: "UNAUTHORIZED" } }`.

**Reprodução:**
```bash
curl -s http://127.0.0.1:4005/auth/me | jq .
# Esperado: { "success": false, "error": { "code": "UNAUTHORIZED" } }
```

---

### TESTE 3: Dotfiles via Nginx — ✅ PASSOU

Acesso a dotfiles e extensões sensíveis via Nginx retorna HTTP 404.

| URL | Código |
|-----|--------|
| /.env | 404 |
| /.git | 404 |
| /.env.local | 404 |

**Reprodução:**
```bash
curl -sk -o /dev/null -w "%{http_code}" https://crm.inovapro.cloud/.env
# Esperado: 404
```

---

### TESTE 4: Headers de Segurança — ✅ PASSOU

Todos os headers de segurança estão presentes nas respostas do Nginx.

| Header | Valor |
|--------|-------|
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
| Server | nginx (sem versão) |

**Reprodução:**
```bash
curl -sk -I https://crm.inovapro.cloud/ | grep -iE "(strict-transport|x-content|x-frame|referrer|permissions|server:)"
```

---

### TESTE 5: PM2 Status — ✅ PASSOU

Todos os processos estão `online` após o reload.

| Processo | Status |
|----------|--------|
| prospector-api | online |
| prospector-dashboard | online |
| prospector-worker | online |
| prospector-scrapy | online |

---

## Testes Adicionais Recomendados (Manual)

### Rate Limiting em Login
```bash
# 11+ tentativas em 1 minuto deve retornar 429
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:4005/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Esperado: 10x 401 (credenciais inválidas), depois 1x+ 429 (rate limit)
```

### IDOR — Settings como AGENT
```bash
# Autenticar como usuário AGENT e tentar PUT /dashboard/settings
# Esperado: 403 FORBIDDEN
curl -s -X PUT http://127.0.0.1:4005/dashboard/settings \
  -H "Authorization: Bearer <token_de_agent>" \
  -H "Content-Type: application/json" \
  -d '{"whatsapp_daily_limit": 999}' | jq .error.code
# Esperado: "FORBIDDEN"
```

### Socket.IO sem Token
```bash
# Conexão WebSocket sem token deve ser rejeitada
node -e "
  const io = require('socket.io-client');
  const s = io('https://crm.inovapro.cloud', { transports: ['websocket'] });
  s.on('connect_error', e => { console.log('REJECTED:', e.message); process.exit(0); });
  setTimeout(() => { console.log('TIMEOUT - conexão não rejeitada!'); process.exit(1); }, 3000);
"
# Esperado: REJECTED: UNAUTHORIZED
```

### Upload Bypass via MIME Spoofing
```bash
# Arquivo .php com Content-Type: text/csv deve ser rejeitado
echo '<?php phpinfo(); ?>' > /tmp/shell.php
curl -s -X POST http://127.0.0.1:4005/leads/import \
  -H "Authorization: Bearer <token_valido>" \
  -F "file=@/tmp/shell.php;type=text/csv" | jq .
# Esperado: 400 "Formato de arquivo não suportado"
```

---

## Resumo

| Teste | Resultado |
|-------|-----------|
| Rotas sem auth → 307 /login | ✅ PASSOU |
| API sem token → 401 | ✅ PASSOU |
| Dotfiles → 404 | ✅ PASSOU |
| Headers de segurança | ✅ PASSOU |
| PM2 todos online | ✅ PASSOU |
| Rate limiting (manual) | 🔲 Pendente verificação manual |
| IDOR AGENT settings (manual) | 🔲 Pendente verificação manual |
| Socket.IO sem token (manual) | 🔲 Pendente verificação manual |
| Upload MIME spoofing (manual) | 🔲 Pendente verificação manual |
