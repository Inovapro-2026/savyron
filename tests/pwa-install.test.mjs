/**
 * TESTES: instalação do app SAVYRON como PWA (card no Dashboard + /settings).
 * - Reutiliza o PWA existente (manifest.ts + public/sw.js + ServiceWorkerRegister).
 * - beforeinstallprompt capturado → prompt nativo; sem prompt → "Como instalar".
 * - Standalone detectado → "Aplicativo instalado" (não insiste).
 * - Sem download falso (APK/EXE) — instalação 100% via navegador.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const HOOK = read("apps/dashboard/components/pwa/use-pwa-install.ts");
const CARD = read("apps/dashboard/components/pwa/install-app-card.tsx");
const DIALOG = read("apps/dashboard/components/pwa/install-app-dialog.tsx");
const PAGE = read("apps/dashboard/app/(dashboard)/dashboard/page.tsx");
const SETTINGS = read("apps/dashboard/app/(dashboard)/settings/page.tsx");
const MANIFEST = read("apps/dashboard/app/manifest.ts");
const SW = read("apps/dashboard/public/sw.js");
const LAYOUT = read("apps/dashboard/app/layout.tsx");

test("pwa: reutiliza a infraestrutura existente (um manifest, um SW, registrado)", () => {
  assert.ok(existsSync("apps/dashboard/public/sw.js"), "service worker existente");
  assert.ok(existsSync("apps/dashboard/app/manifest.ts"), "manifest existente");
  assert.ok(LAYOUT.includes("<ServiceWorkerRegister />"), "SW registrado 1x no layout");
  // Apenas um registro de SW no projeto (uso JSX único):
  assert.ok(
    (LAYOUT.match(/<ServiceWorkerRegister \/>/g) ?? []).length === 1,
    "sem registro duplicado",
  );
  assert.ok(MANIFEST.includes("start_url: '/dashboard'"), "start_url = /dashboard");
  assert.ok(MANIFEST.includes("display: 'standalone'"), "display standalone");
  assert.ok(MANIFEST.includes("name: 'SAVYRON'"), "name SAVYRON");
  assert.ok(/icon-192|icon-512/.test(MANIFEST), "ícones PWA presentes");
});

test("pwa: hook captura beforeinstallprompt e executa prompt() no clique", () => {
  assert.ok(HOOK.includes("beforeinstallprompt"), "escuta o evento");
  assert.ok(HOOK.includes("event.preventDefault()"), "previne o prompt automático");
  assert.ok(HOOK.includes("await prompt.prompt()"), "prompt() no clique do usuário");
  assert.ok(HOOK.includes("userChoice"), "aguarda userChoice");
  assert.ok(
    HOOK.includes("appinstalled"),
    "escuta appinstalled (instalação concluída)",
  );
});

test("pwa: detecta app já instalado (standalone + iOS navigator.standalone)", () => {
  assert.ok(
    HOOK.includes('(display-mode: standalone)'),
    "matchMedia display-mode standalone",
  );
  assert.ok(
    /standalone\?: boolean/.test(HOOK),
    "detecta standalone do iOS (navigator.standalone)",
  );
  assert.ok(HOOK.includes("minimal-ui"), "display-mode minimal-ui também é app");
  // Instalado → sem CTA de instalação:
  assert.ok(
    /state === 'installed'/.test(CARD.replace(/"/g, "'")),
    "card some quando instalado",
  );
});

test("pwa: estados do botão (installable/manual/installing/installed)", () => {
  for (const text of [
    "Instalar aplicativo",
    "Como instalar",
    "Instalando...",
    "Aplicativo instalado",
  ]) {
    assert.ok(CARD.includes(text), `estado com texto "${text}"`);
  }
  // Sem cliques múltiplos durante instalação:
  assert.ok(/case 'installing':[\s\S]*disabled: true/.test(CARD), "installing desabilita o botão");
});

test("pwa: modal 'Como instalar' com instruções por dispositivo", () => {
  assert.ok(DIALOG.includes("Instalar SAVYRON"), "título do modal");
  assert.ok(DIALOG.includes("Adicionar à Tela de Início"), "instrução iOS");
  assert.ok(DIALOG.includes("Instalar aplicativo") || DIALOG.includes("menu do Chrome"), "instrução Android");
  assert.ok(DIALOG.includes("barra de endereço"), "instrução desktop");
  assert.ok(DIALOG.includes("aria-modal"), "acessível");
});

test("pwa: card presente no Dashboard e em /settings (componente reutilizável)", () => {
  assert.ok(PAGE.includes("<InstallAppCard />"), "dashboard renderiza o card");
  assert.ok(SETTINGS.includes("<InstallAppCard />"), "settings reutiliza o mesmo componente");
  assert.ok(PAGE.includes("components/pwa/install-app-card"), "import centralizado");
});

test("pwa: dismiss usa localStorage com chave dedicada (não é fonte de verdade)", () => {
  assert.ok(HOOK.includes("savyron-install-dismissed"), "chave específica");
  assert.ok(CARD.includes("PWA_DISMISS_KEY"), "card usa a chave do hook");
  assert.ok(CARD.includes("DISMISS_TTL_MS"), "dismiss expira (não permanente)");
  // localStorage NÃO decide instalação — só o navegador:
  assert.ok(!/localStorage.*installed/.test(CARD), "instalação real vem do navegador");
});

test("pwa: sem download falso (APK/EXE/DMG)", () => {
  const all = HOOK + CARD + DIALOG;
  assert.ok(!/\.apk/i.test(all), "sem APK");
  assert.ok(!/\.exe/i.test(all), "sem EXE");
  assert.ok(!/\.dmg/i.test(all), "sem DMG");
  assert.ok(!all.includes("download="), "sem atributo download forçado");
});

test("pwa: SW não agressivo (navegação network-first evita ChunkLoadError)", () => {
  // Páginas: network-first — chunks antigos não ficam presos:
  assert.ok(SW.includes("network-first"), "estratégia network-first para navegação");
  assert.ok(/CACHE_NAME = 'savyron-v\d+'/.test(SW), "cache versionado");
  // Ativação limpa caches antigos (não mantém versão presa):
  assert.ok(SW.includes("caches.delete(k)"), "limpa caches de versões antigas");
  assert.ok(SW.includes("skipWaiting"), "nova versão ativa imediatamente");
  assert.ok(SW.includes("clients.claim()"), "SW assume as abas abertas");
});

test("pwa: card respeita temas (classe card/tema + sem fundo preto fixo no light)", () => {
  // O card usa o padrão visual do dashboard (tokens/tema), não fundo fixo:
  assert.ok(CARD.includes("backdrop-blur-xl"), "estilo glass do SAVYRON");
  // O dialog usa a classe .card (tema escuro e claro via dashboard.css):
  assert.ok(DIALOG.includes('className="card'), "dialog usa classe .card tematizada");
});
