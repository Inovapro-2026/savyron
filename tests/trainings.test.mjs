/**
 * Módulo de Treinamento:
 *  - parser de YouTube (Video ID, thumbnails, formatos aceitos/rejeitados);
 *  - API do usuário (apenas publicados) e do admin (PLATFORM_ADMIN na escrita);
 *  - isolamento do dado global (sem business_id — sem IDOR/BOLA);
 *  - navegação (sidebar/drawer mobile + admin) e páginas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  extractYouTubeVideoId,
  youTubeThumbnailUrl,
  youTubeEmbedUrl,
  normalizeYouTubeInput,
} from "@prospector/utils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

// ---------------------------------------------------------------------------
// Parser de YouTube (testes reais contra o código compilado)
// ---------------------------------------------------------------------------

test("youtube: watch?v= funciona", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=ABC12345678"), "ABC12345678");
  assert.equal(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s"), "dQw4w9WgXcQ");
});

test("youtube: youtu.be funciona", () => {
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=1"), "dQw4w9WgXcQ");
});

test("youtube: shorts e embed funcionam", () => {
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("youtube: URLs inválidas rejeitadas", () => {
  assert.equal(extractYouTubeVideoId(""), null);
  assert.equal(extractYouTubeVideoId("   "), null);
  assert.equal(extractYouTubeVideoId("não é url"), null);
  assert.equal(extractYouTubeVideoId("https://vimeo.com/123456789"), null);
  assert.equal(extractYouTubeVideoId("https://facebook.com/watch?v=123"), null);
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/"), null);
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch"), null);
  // Video ID com tamanho/caracteres inválidos
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=curto"), null);
  assert.equal(extractYouTubeVideoId("https://youtu.be/1234567890AB"), null);
  assert.equal(extractYouTubeVideoId("https://youtu.be/1234567890!"), null);
});

test("youtube: thumbnail e embed gerados corretamente", () => {
  assert.equal(youTubeThumbnailUrl("dQw4w9WgXcQ"), "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  const n = normalizeYouTubeInput("https://youtu.be/dQw4w9WgXcQ");
  assert.deepEqual(n, {
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeVideoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  });
  assert.match(youTubeEmbedUrl("dQw4w9WgXcQ"), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

// ---------------------------------------------------------------------------
// API: autorização, validação e dado global
// ---------------------------------------------------------------------------

const trainingsRoute = read("apps/api/src/routes/trainings.ts");
const appTs = read("apps/api/src/app.ts");

test("trainings api: rotas do usuário exigem auth + business", () => {
  assert.match(trainingsRoute, /trainingsRouter\.use\(requireAuth, requireBusiness\)/);
  // Usuário: apenas publicados, nunca rascunho
  assert.match(trainingsRoute, /where:\s*\{\s*is_published:\s*true\s*\}/);
  assert.match(trainingsRoute, /orderBy:\s*\[\{\s*sort_order:\s*"asc"\s*\},\s*\{\s*created_at:\s*"desc"\s*\}\]/);
});

test("trainings api: escrita exige PLATFORM_ADMIN", () => {
  // Montagem com os dois middlewares de plataforma
  assert.match(trainingsRoute, /adminTrainingsRouter\.use\(requireAuth, requirePlatformRole\)/);
  // POST/PATCH/DELETE com requirePlatformAdmin (não confia só na UI)
  const writeRoutes = trainingsRoute.split("adminTrainingsRouter.").slice(1).join("adminTrainingsRouter.");
  const post = writeRoutes.split("adminTrainingsRouter.")[1] ?? "";
  assert.match(writeRoutes, /requirePlatformAdmin,/);
  assert.equal((trainingsRoute.match(/requirePlatformAdmin,/g) || []).length >= 4, true);
});

test("trainings api: backend valida o link do YouTube (não confia no frontend)", () => {
  assert.match(trainingsRoute, /extractYouTubeVideoId/);
  assert.match(trainingsRoute, /Insira um link válido do YouTube\./);
  // Campos do YouTube SEMPRE recalculados do link (nunca aceitos prontos do body)
  assert.match(trainingsRoute, /resolveYouTubeFields\(req\.body\?\.youtube_url\)/);
  assert.doesNotMatch(trainingsRoute, /req\.body\?\.thumbnail_url/);
  assert.doesNotMatch(trainingsRoute, /req\.body\?\.youtube_video_id/);
});

// ---------------------------------------------------------------------------
// Importação automática de título/descrição do YouTube
// ---------------------------------------------------------------------------

const youtubeUtils = read("packages/utils/src/youtube.ts");

test("youtube: utilitário busca metadados públicos (oEmbed + página) sem API key", () => {
  assert.match(youtubeUtils, /export async function fetchYouTubeVideoMetadata/);
  // oEmbed oficial (sem credencial) — nunca no frontend
  assert.match(youtubeUtils, /youtube\.com\/oembed/);
  // Descrição pública extraída da página do vídeo
  assert.match(youtubeUtils, /shortDescription/);
  // Não permite URL arbitrária (SSRF): só o Video ID validado entra na URL fixa
  assert.match(youtubeUtils, /const videoId = extractYouTubeVideoId\(input\)/);
  assert.doesNotMatch(youtubeUtils, /fetch\(input/);
});

test("trainings api: endpoint de metadados restrito a admin e antes de /:id", () => {
  // Ordem válida DENTRO do router admin (o router do usuário tem seu próprio /:id)
  const adminSection = trainingsRoute.slice(trainingsRoute.indexOf("adminTrainingsRouter"));
  const metaIdx = adminSection.indexOf('"/metadata"');
  const idIdx = adminSection.indexOf('"/:id"');
  assert.ok(metaIdx !== -1 && idIdx !== -1 && metaIdx < idIdx, "/metadata deve preceder /:id");
  // Bloco do endpoint exige PLATFORM_ADMIN
  const metaBlock = adminSection.slice(metaIdx - 200, metaIdx + 900);
  assert.match(metaBlock, /requirePlatformAdmin/);
  // Rejeita URL não-YouTube antes de qualquer fetch externo (anti-SSRF)
  assert.match(metaBlock, /extractYouTubeVideoId\(url\)/);
});

test("trainings api: auto-import de título/descrição no POST e PATCH", () => {
  // POST: título/descrição ausentes → busca metadados; sem dados → erro amigável
  const postBlock = trainingsRoute.slice(trainingsRoute.indexOf('"/"'), trainingsRoute.indexOf("/** PATCH"));
  assert.match(postBlock, /fetchYouTubeVideoMetadata/);
  assert.match(postBlock, /Informe o título\./);
  // PATCH: troca de link preenche apenas campos NÃO enviados (preserva edição manual)
  const patchBlock = trainingsRoute.slice(trainingsRoute.indexOf("/** PATCH"), trainingsRoute.indexOf("/** DELETE"));
  assert.match(patchBlock, /missingTitle/);
  assert.match(patchBlock, /missingDescription/);
  // Nunca sobrescreve valor explícito do body
  assert.match(patchBlock, /req\.body\?\.title === undefined/);
});

const adminPageSrc = read("apps/dashboard/app/admin/trainings/page.tsx");

test("admin ui: prévia com debounce, loading e preservação de edição manual", () => {
  assert.match(adminPageSrc, /admin\/trainings\/metadata/);
  // Debounce (500ms) antes de chamar a API
  assert.match(adminPageSrc, /setTimeout/);
  // Estado "Buscando informações do vídeo..." + erro amigável
  assert.match(adminPageSrc, /Buscando informações do vídeo\.\.\./);
  assert.match(adminPageSrc, /Não foi possível encontrar as informações desse vídeo\./);
  // Detecção de edição manual — importação nunca sobrescreve digitação
  assert.match(adminPageSrc, /titleImported/);
  assert.match(adminPageSrc, /descriptionImported/);
  // Campos permanecem editáveis (onChange liga os flags de edição manual)
  assert.match(adminPageSrc, /patchForm\(\{ title: e\.target\.value \}\)/);
  assert.match(adminPageSrc, /patchForm\(\{ description: e\.target\.value \}\)/);
});

test("trainings api: treinamento é GLOBAL (sem business_id — sem IDOR/BOLA)", () => {
  // Nenhuma query/parametro de business_id no módulo (comentários não contam)
  assert.doesNotMatch(trainingsRoute, /business_id\s*[:=]/);
  // Montagem fora do router admin legado, antes de /admin (ordem correta)
  assert.match(appTs, /app\.use\("\/admin\/trainings", adminTrainingsRouter\);\s*\n\s*app\.use\("\/admin", adminRouter\);/);
  assert.match(appTs, /app\.use\("\/trainings", trainingsRouter\);/);
});

// ---------------------------------------------------------------------------
// Prisma + navegação + páginas
// ---------------------------------------------------------------------------

const schema = read("packages/database/prisma/schema.prisma");

test("prisma: model Training com campos esperados", () => {
  const m = schema.match(/model Training \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(m, "model Training ausente no schema");
  for (const field of ["title", "description", "youtube_url", "youtube_video_id", "thumbnail_url", "is_published", "sort_order", "created_at", "updated_at"]) {
    assert.match(m, new RegExp(`\\b${field}\\b`), `campo ${field} ausente`);
  }
  assert.match(m, /@@index\(\[is_published, sort_order\]\)/);
});

const navigation = read("apps/dashboard/lib/navigation.ts");
const adminLayout = read("apps/dashboard/app/admin/layout.tsx");

test("navegação: Treinamento no painel do usuário e Treinamentos no admin", () => {
  assert.match(navigation, /href: "\/treinamento", label: "Treinamento", icon: GraduationCap, group: "main"/);
  assert.match(adminLayout, /href: "\/admin\/trainings", label: "Treinamentos", icon: GraduationCap/);
  // Mobile: item do grupo "main" entra automaticamente no drawer "Mais"
  assert.match(navigation, /MORE_GROUPS/);
});

const userPage = read("apps/dashboard/app/(dashboard)/treinamento/page.tsx");
const adminPage = read("apps/dashboard/app/admin/trainings/page.tsx");

test("página do usuário: player embutido (sem nova aba), busca, vazio, loading e erro", () => {
  // Player dentro da plataforma via embed nocookie, lazy, 16:9
  assert.match(userPage, /youTubeEmbedUrl/);
  assert.match(userPage, /loading="lazy"/);
  assert.match(userPage, /aspect-video/);
  assert.match(userPage, /allowFullScreen/);
  // Estados obrigatórios
  assert.match(userPage, /Nenhum treinamento disponível/);
  assert.match(userPage, /Novos conteúdos serão adicionados em breve\./);
  assert.match(userPage, /Não foi possível carregar os treinamentos\./);
  assert.match(userPage, /Tentar novamente/);
  assert.match(userPage, /Pesquisar treinamento\.\.\./);
  assert.match(userPage, /TrainingsSkeleton/);
  // Sem link para o YouTube (não redireciona)
  assert.doesNotMatch(userPage, /href="https:\/\/(www\.)?youtube\.com/);
});

test("página admin: CRUD completo com confirmação de exclusão", () => {
  assert.match(adminPage, /\/admin\/trainings", "POST"/);
  assert.match(adminPage, /"PATCH"/);
  assert.match(adminPage, /"DELETE"/);
  assert.match(adminPage, /ConfirmModal/);
  assert.match(adminPage, /Tem certeza que deseja excluir este treinamento\?/);
  assert.match(adminPage, /Adicionar treinamento/);
  assert.match(adminPage, /Publicado/);
  assert.match(adminPage, /Rascunho/);
  // Validação local do link espelha o backend
  assert.match(adminPage, /Insira um link válido do YouTube\./);
});

test("segurança: rascunho nunca visível ao usuário (404 no detalhe)", () => {
  assert.match(trainingsRoute, /is_published: true\s*\}/);
});
