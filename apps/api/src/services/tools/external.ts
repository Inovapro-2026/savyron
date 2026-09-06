import { createLogger } from "@prospector/logger";
import type { ToolDefinition, ToolResult } from "./index";

const logger = createLogger("api.tools.external");

export const EXTERNAL_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Pesquisa informações atualizadas na web. Use para consultar notícias, preços, concorrentes, tendências, informações atuais sobre empresas, produtos, serviços, segmentos de mercado. Ex.: 'Pesquise concorrentes da minha empresa', 'Quais as tendências do mercado?', 'Quanto custa este produto?', 'Pesquise empresas que oferecem serviços de marketing digital em SP'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de pesquisa" },
          max_results: { type: "integer", description: "Máximo de resultados (padrão 5, máximo 10)", default: 5 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Obtém a previsão do tempo atual para uma cidade. Use para responder 'qual a previsão do tempo hoje?', 'vai chover amanhã?', 'como está o tempo agora?'.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "Nome da cidade (ex.: São Paulo, Rio de Janeiro)" },
          state: { type: "string", description: "Sigla do estado (opcional, ex.: SP, RJ)" },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_exchange_rate",
      description: "Obtém a cotação atual de moedas. Use para responder 'qual a cotação do dólar?', 'quanto vale o euro hoje?', 'conversão de moedas'.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Moeda de origem (ex.: USD, EUR, BRL)", default: "USD" },
          to: { type: "string", description: "Moeda de destino (ex.: BRL, USD, EUR)", default: "BRL" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_news",
      description: "Obtém notícias recentes sobre um tópico ou do mercado em geral. Use para 'quais as últimas notícias?', 'o que está acontecendo no mercado?', 'notícias sobre [assunto]'.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Tópico ou assunto para buscar notícias (opcional, ex.: tecnologia, mercado financeiro, economia)" },
          max_results: { type: "integer", description: "Máximo de resultados (padrão 5, máximo 10)", default: 5 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_feriados",
      description: "Obtém os feriados nacionais e estaduais de um ano. Use para consultar feriados, saber se uma data é feriado.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Ano (opcional, padrão: ano atual)" },
          state: { type: "string", description: "Sigla do estado para feriados estaduais (opcional, ex.: SP)" },
        },
      },
    },
  },
];

export async function executeExternalTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "search_web": {
      const query = String(args.query ?? "").trim();
      const maxResults = Math.min(Math.max(Number(args.max_results) || 5, 1), 10);

      if (!query) {
        return { result: { error: "Termo de pesquisa é obrigatório" }, stateChanged: false };
      }

      // Helper: extrai URL real do redirect do DuckDuckGo (uddg=...)
      const decodeDdgUrl = (href: string): string => {
        try {
          const m = href.match(/[?&]uddg=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : href.startsWith("//") ? `https:${href}` : href;
        } catch {
          return href;
        }
      };

      const stripHtml = (html: string): string =>
        html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
          .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

      // --- 0) Cotações de moeda via AwesomeAPI (gratuita, sem chave) ---
      const qLower = query.toLowerCase();
      const CURRENCY_PAIRS: Array<[RegExp, string, string, string]> = [
        [/d[óo]lar|dolar|usd/i, "USD", "BRL", "Dólar americano"],
        [/euro|eur\b/i, "EUR", "BRL", "Euro"],
        [/libra|gbp/i, "GBP", "BRL", "Libra esterlina"],
        [/iene|yen|jpy/i, "JPY", "BRL", "Iene japonês"],
        [/bitcoin|btc/i, "BTC", "BRL", "Bitcoin"],
      ];
      for (const [re, from, to, label] of CURRENCY_PAIRS) {
        if (re.test(qLower) && /(hoje|cota|pre[çc]o|valor|quanto)/i.test(qLower)) {
          try {
            const cres = await fetch(`https://economia.awesomeapi.com.br/last/${from}-${to}`, { signal: AbortSignal.timeout(8000) });
            if (cres.ok) {
              const cdata = await cres.json() as any;
              const c = cdata[`${from}${to}`];
              if (c) {
                const changePct = Number(c.pctChange);
                return {
                  result: {
                    source: "AwesomeAPI (cotação oficial)",
                    query,
                    moeda: label,
                    valor_atual: `R$ ${Number(c.bid).toFixed(4).replace(".", ",")}`,
                    maximo_do_dia: `R$ ${Number(c.high).toFixed(4).replace(".", ",")}`,
                    minimo_do_dia: `R$ ${Number(c.low).toFixed(4).replace(".", ",")}`,
                    variacao_pct: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`,
                    atualizado_em: new Date(Number(c.timestamp) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                  },
                  stateChanged: false,
                };
              }
            }
          } catch { /* segue para busca web */ }
        }
      }

      // --- 1) DuckDuckGo HTML (resultados reais da web) ---
      try {
        const res = await fetch("https://html.duckduckgo.com/html/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          },
          body: `q=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const html = await res.text();
          // Ambas as variações capturam: grupo 1 = href, grupo 2 = título
          // a) <a class="result__a" href="...">título</a>
          // b) <a href="..." class="result__a">título</a>
          const seen = new Set<string>();
          const all = [
            ...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
            ...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/g),
          ];
          const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map(m => stripHtml(m[1]));
          const results = all
            .map((m, i) => ({ title: stripHtml(m[2]), url: decodeDdgUrl(m[1]), snippet: snippets[i] ?? "" }))
            .filter(r => {
              if (!r.title || !r.url || seen.has(r.url)) return false;
              seen.add(r.url);
              return true;
            })
            .slice(0, maxResults);

          if (results.length > 0) {
            return {
              result: {
                source: "DuckDuckGo",
                query,
                results,
                count: results.length,
              },
              stateChanged: false,
            };
          }
        }
      } catch (error) {
        logger.warn("Falha no DuckDuckGo HTML, tentando fallback", { error: error instanceof Error ? error.message : String(error) });
      }

      // --- 2) Wikipédia PT (busca real por título + resumo) ---
      try {
        const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${maxResults}`;
        const sres = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
        if (sres.ok) {
          const sdata = await sres.json() as any;
          const hits = sdata?.query?.search ?? [];
          const results: Array<{ title: string; snippet: string; url: string }> = [];
          for (const hit of hits.slice(0, maxResults)) {
            let extract = stripHtml(hit.snippet ?? "") + "...";
            try {
              const sumUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
              const sumRes = await fetch(sumUrl, { signal: AbortSignal.timeout(8000) });
              if (sumRes.ok) {
                const sumData = await sumRes.json() as any;
                if (sumData.extract) extract = String(sumData.extract).slice(0, 1200);
              }
            } catch { /* usa snippet */ }
            results.push({
              title: hit.title,
              snippet: extract,
              url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
            });
          }
          if (results.length > 0) {
            return {
              result: { source: "Wikipedia", query, results, count: results.length },
              stateChanged: false,
            };
          }
        }
      } catch (error) {
        logger.warn("Falha na Wikipédia PT", { error: error instanceof Error ? error.message : String(error) });
      }

      // --- 3) DuckDuckGo Instant Answer (último recurso) ---
      try {
        const duckUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
        const duckRes = await fetch(duckUrl, { signal: AbortSignal.timeout(10000) });
        if (duckRes.ok) {
          const duckData = await duckRes.json() as any;
          const results = duckData.RelatedTopics?.slice(0, maxResults).map((r: any) => ({
            title: (r.Text ?? "").slice(0, 80),
            url: r.FirstURL ?? "",
            snippet: r.Text ?? "",
          })).filter((r: any) => r.title) ?? [];
          if (duckData.AbstractText || results.length > 0) {
            return {
              result: {
                source: "DuckDuckGo",
                query,
                abstract: duckData.AbstractText ?? "",
                results,
                count: results.length,
              },
              stateChanged: false,
            };
          }
        }
      } catch { /* segue para erro */ }

      return { result: { error: "Pesquisa web indisponível no momento. Tente novamente mais tarde.", results: [] }, stateChanged: false };
    }

    case "get_weather": {
      const city = String(args.city ?? "").trim();
      if (!city) {
        return { result: { error: "Cidade é obrigatória" }, stateChanged: false };
      }

      try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w&lang=pt`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const text = await res.text();
          return {
            result: {
              city,
              weather: text.trim(),
              source: "wttr.in",
            },
            stateChanged: false,
          };
        }
        return { result: { error: "Previsão do tempo indisponível" }, stateChanged: false };
      } catch (error) {
        logger.warn("Falha ao obter previsão do tempo", { error: error instanceof Error ? error.message : String(error) });
        return { result: { error: "Previsão do tempo indisponível no momento" }, stateChanged: false };
      }
    }

    case "get_exchange_rate": {
      const from = String(args.from ?? "USD").toUpperCase().trim();
      const to = String(args.to ?? "BRL").toUpperCase().trim();

      try {
        const url = `https://api.exchangerate-api.com/v4/latest/${from}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json() as any;
          const rate = data.rates?.[to];
          if (rate) {
            return {
              result: {
                from,
                to,
                rate,
                date: data.date,
                source: "ExchangeRate-API",
              },
              stateChanged: false,
            };
          }
        }
        return { result: { error: `Cotação ${from} para ${to} indisponível` }, stateChanged: false };
      } catch (error) {
        logger.warn("Falha ao obter cotação", { error: error instanceof Error ? error.message : String(error) });
        return { result: { error: "Cotação indisponível no momento" }, stateChanged: false };
      }
    }

    case "get_news": {
      const topic = String(args.topic ?? "").trim();
      const maxResults = Math.min(Math.max(Number(args.max_results) || 5, 1), 10);

      // Google News RSS (gratuito, sem chave, em português)
      try {
        const query = topic ? encodeURIComponent(topic) : encodeURIComponent("Brasil");
        const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const xml = await res.text();
          const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, maxResults).map(m => {
            const item = m[1];
            const pick = (tag: string) => {
              const mm = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
              return mm ? mm[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() : "";
            };
            return {
              title: pick("title"),
              url: pick("link"),
              source: pick("source") || (item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? ""),
              published_at: pick("pubDate"),
            };
          }).filter(a => a.title);

          if (items.length > 0) {
            return {
              result: { topic: topic || "geral", articles: items, count: items.length, source: "Google News" },
              stateChanged: false,
            };
          }
        }
      } catch (error) {
        logger.warn("Falha no Google News RSS", { error: error instanceof Error ? error.message : String(error) });
      }

      return { result: { error: "Notícias indisponíveis no momento", articles: [] }, stateChanged: false };
    }

    case "get_feriados": {
      const year = Number(args.year) || new Date().getFullYear();
      const state = args.state ? String(args.state).toUpperCase().trim() : undefined;

      try {
        const url = `https://brasilapi.com.br/api/feriados/v1/${year}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json() as any[];
          return {
            result: {
              year,
              feriados: data.map((f: any) => ({
                date: f.date,
                name: f.name,
                type: f.type ?? "nacional",
              })),
              count: data.length,
              source: "Brasil API",
            },
            stateChanged: false,
          };
        }
        return { result: { error: "Feriados indisponíveis" }, stateChanged: false };
      } catch (error) {
        logger.warn("Falha ao obter feriados", { error: error instanceof Error ? error.message : String(error) });
        return { result: { error: "Feriados indisponíveis no momento" }, stateChanged: false };
      }
    }

    default:
      return { result: { error: `Ferramenta externa desconhecida: ${name}` }, stateChanged: false };
  }
}