/**
 * Utilitários de YouTube para o módulo de Treinamento.
 * Extrai o Video ID de forma segura a partir das formas oficiais de URL,
 * gera thumbnail e embed (youtube-nocookie). Reutilizado por API e dashboard.
 */

/** Hostnames aceitos como YouTube. */
const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** IDs de vídeo do YouTube: 11 caracteres [A-Za-z0-9_-]. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrai o Video ID (11 chars) de URLs válidas do YouTube.
 * Aceita: youtube.com/watch?v= · youtu.be/ · youtube.com/shorts/ ·
 * youtube.com/embed/ · youtube.com/live/ · youtube-nocookie.com (equivalentes).
 * Retorna null para URLs vazias, inválidas, de outros sites ou sem ID.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw || raw.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (!YT_HOSTS.has(url.hostname.toLowerCase())) return null;

  // youtu.be/<id>
  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  // /shorts/<id> · /embed/<id> · /live/<id> · /v/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  const pathKey = segments[0]?.toLowerCase();
  if (["shorts", "embed", "live", "v"].includes(pathKey ?? "")) {
    const id = segments[1] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  // /watch?v=<id> (e /watch/<id>, forma antiga)
  if (pathKey === "watch") {
    const v = url.searchParams.get("v") ?? "";
    if (VIDEO_ID_RE.test(v)) return v;
    const alt = segments[1] ?? "";
    return VIDEO_ID_RE.test(alt) ? alt : null;
  }

  return null;
}

/** Thumbnail oficial do YouTube (hqdefault — sempre disponível). */
export function youTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** Embed oficial, privacidade avançada (youtube-nocookie), lazy-friendly. */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

/**
 * Normaliza a entrada do Admin para os campos persistidos:
 * URL canônica watch + Video ID + thumbnail. Retorna null se inválida.
 */
export function normalizeYouTubeInput(input: string): {
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
} | null {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;
  return {
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    youtubeVideoId: videoId,
    thumbnailUrl: youTubeThumbnailUrl(videoId),
  };
}

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string;
}

/**
 * Busca título/descrição do vídeo no próprio YouTube (server-side).
 *  1. oEmbed público — título e autor oficiais (rápido e estável).
 *  2. Página do vídeo — "shortDescription" do ytInitialPlayerResponse.
 * Best-effort: em falha de rede/quota devolve o que conseguir (null nos campos).
 */
export async function fetchYouTubeVideoMetadata(
  input: string,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {},
): Promise<YouTubeVideoMetadata | null> {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;

  const thumbnailUrl = youTubeThumbnailUrl(videoId);
  let title: string | null = null;
  let description: string | null = null;

  // 1) oEmbed (título oficial; descrição não existe no oEmbed)
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { title?: unknown };
      if (typeof json.title === "string" && json.title.trim()) {
        title = json.title.trim();
      }
    }
  } catch {
    // segue para a raspagem da página
  }

  // 2) Página do vídeo: shortDescription (+ título como fallback)
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const html = await res.text();
      if (!title) {
        const t = html.match(/"title":"((?:[^"\\]|\\.)*)"/);
        if (t?.[1]) {
          try {
            const decoded = JSON.parse(`"${t[1]}"`) as string;
            if (decoded.trim()) title = decoded.trim();
          } catch {
            /* mantém null */
          }
        }
      }
      const d = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (d?.[1]) {
        try {
          const decoded = JSON.parse(`"${d[1]}"`) as string;
          if (decoded.trim()) description = decoded.trim().slice(0, 2000);
        } catch {
          /* mantém null */
        }
      }
    }
  } catch {
    // retorna o que temos (title pode ser null)
  }

  return { videoId, title, description, thumbnailUrl };
}
