/**
 * TESTES: sistema de tema dark/light do SAVYRON.
 *
 * Garante:
 * 1. DARK é o padrão (sem preferência salva e sem atributo no html).
 * 2. Persistência via localStorage com a chave `savyron-theme`.
 * 3. Script anti-flash presente no layout (aplica antes da primeira pintura).
 * 4. Tokens light existem em globals.css e overrides em dashboard.css.
 * 5. Seletor visual presente em /settings (seção Aparência).
 * 6. Dark permanece o default — [data-theme] só existe para light.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

const PROVIDER = read("apps/dashboard/components/theme/theme-provider.tsx");
const LAYOUT = read("apps/dashboard/app/layout.tsx");
const GLOBALS = read("apps/dashboard/app/globals.css");
const DASHBOARD_CSS = read("apps/dashboard/app/(dashboard)/dashboard.css");
const SETTINGS = read("apps/dashboard/app/(dashboard)/settings/page.tsx");
const SELECTOR = read("apps/dashboard/components/theme/theme-selector.tsx");
const PROVIDERS = read("apps/dashboard/components/providers.tsx");

test("theme: dark é o padrão — sem preferência, applyTheme/removeAttribute", () => {
  assert.ok(PROVIDER.includes("removeAttribute('data-theme')") || PROVIDER.includes('removeAttribute("data-theme")'),
    "applyTheme deve remover o atributo no dark (default)");
  assert.ok(!PROVIDER.includes("data-theme\", 'dark'"), "Não deve setar data-theme=dark explicitamente (default = ausência)");
});

test("theme: chave de persistência é savyron-theme com valores dark|light", () => {
  assert.ok(PROVIDER.includes("savyron-theme"));
  assert.match(PROVIDER, /isValidTheme/);
});

test("theme: script anti-flash no layout, antes da primeira pintura", () => {
  assert.ok(LAYOUT.includes("THEME_INIT_SCRIPT"), "layout deve injetar THEME_INIT_SCRIPT");
  assert.match(PROVIDER, /localStorage\.getItem/);
  assert.ok(LAYOUT.includes("suppressHydrationWarning"));
});

test("theme: providers integra ThemeProvider", () => {
  assert.ok(PROVIDERS.includes("<ThemeProvider>"));
});

test("theme: tokens light existem em globals.css e dark permanece o default", () => {
  assert.ok(GLOBALS.includes("[data-theme='light']") || GLOBALS.includes('[data-theme="light"]'));
  // dark intacto:
  assert.ok(GLOBALS.includes("--savyron-bg: #020409"), "token dark original preservado");
  assert.ok(GLOBALS.includes("color-scheme: dark"), "color-scheme dark preservado");
  // light tokens principais:
  assert.ok(GLOBALS.includes("#F6F8FA"), "background light");
  assert.ok(GLOBALS.includes("#0969DA"), "primary light");
  assert.ok(GLOBALS.includes("color-scheme: light"));
});

test("theme: overrides light cobrem sidebar, topbar, tabelas, bottom nav e cards", () => {
  assert.ok(DASHBOARD_CSS.includes("html[data-theme='light'] .dashboard-wrapper aside"));
  assert.ok(DASHBOARD_CSS.includes("html[data-theme='light'] .dashboard-wrapper header"));
  assert.ok(DASHBOARD_CSS.includes("html[data-theme='light'] .dashboard-dark-theme table th"));
  assert.ok(DASHBOARD_CSS.includes("html[data-theme='light'] .dashboard-wrapper nav"));
  assert.ok(DASHBOARD_CSS.includes("html[data-theme='light'] .dashboard-dark-theme .card"));
});

test("theme: light não destrói o dark — overrides escopados por [data-theme=light]", () => {
  // todas as regras light devem começar com html[data-theme='light']
  const lines = DASHBOARD_CSS.split("\n");
  const lightBlockStart = lines.findIndex((l) => l.includes("TEMA CLARO — SAVYRON Premium Light"));
  assert.ok(lightBlockStart > 0, "bloco light presente");
  // regra fora do escopo adicionada depois do início do bloco light:
  const after = lines.slice(lightBlockStart).join("\n");
  const violations = after.match(/^\.(?!\d)/gm) ?? []; // linhas de regra fora do escopo
  assert.equal(violations.length, 0, "nenhuma regra light sem escopo html[data-theme]");
});

test("theme: seletor visual em /settings com Aparência e ícones Sun/Moon", () => {
  assert.ok(SETTINGS.includes("<ThemeSelector />"));
  assert.ok(SETTINGS.includes("import { ThemeSelector }"));
  assert.ok(SELECTOR.includes("Aparência"));
  assert.ok(SELECTOR.includes("Escolha como o SAVYRON deve aparecer para você"));
  assert.ok(SELECTOR.includes("Moon"));
  assert.ok(SELECTOR.includes("Sun"));
  assert.ok(SELECTOR.includes("role=\"radiogroup\""));
});

test("theme: localStorage é a persistência (sem banco de dados para tema)", () => {
  assert.match(PROVIDER, /localStorage/);
  // Nenhuma chamada de API/DB no provider:
  assert.ok(!PROVIDER.includes("fetch("));
  assert.ok(!PROVIDER.includes("apiFetch"));
  assert.ok(!PROVIDER.includes("request("));
});
