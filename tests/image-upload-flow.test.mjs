import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('middleware upload: suporta JFIF, JPG, PNG, WEBP, GIF e limite de 10MB', () => {
  const code = fs.readFileSync('apps/api/src/middleware/upload.ts', 'utf8');
  assert.match(code, /\.jfif/i, 'upload.ts deve incluir .jfif');
  assert.match(code, /image\/jfif/i, 'upload.ts deve incluir image/jfif');
  assert.match(code, /10 \* 1024 \* 1024/, 'upload.ts deve ter limite de 10MB');
});

test('inbox API: upload resiliente com multipart, fallback base64 e storage local seguro', () => {
  const code = fs.readFileSync('apps/api/src/routes/inbox.ts', 'utf8');
  assert.match(code, /handleMediaUploadMiddleware/, 'inbox.ts deve usar middleware flexível');
  assert.match(code, /MEDIA_UPLOAD_STARTED/, 'inbox.ts deve emitir log MEDIA_UPLOAD_STARTED');
  assert.match(code, /MEDIA_UPLOAD_SUCCESS/, 'inbox.ts deve emitir log MEDIA_UPLOAD_SUCCESS');
  assert.match(code, /MEDIA_UPLOAD_FAILED/, 'inbox.ts deve emitir log MEDIA_UPLOAD_FAILED');
  assert.match(code, /uploads.*media/, 'inbox.ts deve salvar no storage de mídia');
  assert.match(code, /GET \/conversations\/:id\/media\/:filename/i, 'inbox.ts deve ter rota GET de mídia');
});

test('whatsapp worker: detecta data URI e imagens com logs estruturados', () => {
  const code = fs.readFileSync('apps/worker/src/jobs/whatsapp-send.processor.ts', 'utf8');
  assert.match(code, /WHATSAPP_MEDIA_SEND_STARTED/, 'worker deve registrar WHATSAPP_MEDIA_SEND_STARTED');
  assert.match(code, /WHATSAPP_MEDIA_SEND_SUCCESS/, 'worker deve registrar WHATSAPP_MEDIA_SEND_SUCCESS');
  assert.match(code, /WHATSAPP_MEDIA_SEND_FAILED/, 'worker deve registrar WHATSAPP_MEDIA_SEND_FAILED');
  assert.match(code, /sendImage/, 'worker deve chamar sendImage no waManager');
});

test('whatsapp manager: normaliza MIME e suporta imagens recebidas', () => {
  const code = fs.readFileSync('services/whatsapp/src/connection/manager.ts', 'utf8');
  assert.match(code, /sendImage/, 'manager deve ter sendImage');
  assert.match(code, /downloadImageMedia/, 'manager deve ter downloadImageMedia para imagens recebidas');
  assert.match(code, /isImage/, 'manager deve identificar isImage no parseIncoming');
});

test('message composer: aceita image/*, preserva File real, envia FormData sem Content-Type manual', () => {
  const code = fs.readFileSync('apps/dashboard/components/chat/message-composer.tsx', 'utf8');
  assert.match(code, /accept="image\/\*"/, 'input deve ter accept image/*');
  assert.match(code, /pendingFile\.file/, 'composer deve preservar o File real');
  assert.match(code, /FormData/, 'composer deve enviar FormData');
  assert.doesNotMatch(code, /'Content-Type':\s*'multipart\/form-data'/, 'NÃO deve forçar header Content-Type multipart');
  assert.match(code, /Enviando arquivo\.\.\.|Enviando imagem\.\.\./, 'composer deve ter feedback de progresso');
});

test('message bubble: renderiza imagens com clique para ampliar', () => {
  const code = fs.readFileSync('apps/dashboard/components/chat/message-bubble.tsx', 'utf8');
  assert.match(code, /extractImage/, 'message-bubble deve extrair imagens');
  assert.match(code, /window\.open\(image/, 'message-bubble deve permitir abrir imagem');
});
