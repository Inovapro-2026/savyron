/**
 * Camada visual de intenção do Agente (intent → visual state).
 *
 * REGRA: esta camada NÃO decide negócio. Ela apenas interpreta o texto
 * (transcrição do usuário + ferramentas usadas pela IA) para escolher qual
 * representação visual mostrar. Os dados exibidos nos cards vêm SEMPRE das
 * APIs reais (/financial/summary, /calendar/events, /campaigns, /dashboard).
 *
 * Módulo puro (sem React) — testável.
 */

export type AgentIntentMode =
  | "idle"
  | "agenda"
  | "finance"
  | "campaign"
  | "search"
  | "leads"
  | "reports";

export interface IntentSignal {
  mode: AgentIntentMode;
  /** Palavra-chave que disparou a detecção (para debug/log visual). */
  keyword: string;
  /** Fonte do sinal: texto do usuário ou ferramenta executada pela IA. */
  source: "user-text" | "tool-call";
}

/** Ferramentas somente-leitura reais mapeadas para modos visuais. */
const TOOL_MODE_MAP: Readonly<Record<string, AgentIntentMode>> = {
  // Agenda
  list_calendar_events: "agenda",
  list_reminders: "agenda",
  parse_date: "agenda",
  check_event_conflicts: "agenda",
  find_free_slots: "agenda",
  // Financeiro / projeções
  get_financial_summary: "finance",
  list_financial_transactions: "finance",
  get_financial_categories: "finance",
  get_financial_projection: "finance",
  project_month: "finance",
  project_expenses: "finance",
  project_income: "finance",
  project_sales: "finance",
  // Pesquisa externa
  search_web: "search",
  get_news: "search",
  get_weather: "search",
  get_exchange_rate: "search",
  get_feriados: "search",
  // SAVYRON (leitura)
  get_leads: "leads",
  get_clients: "leads",
  get_campaigns: "campaign",
  get_campaign_status: "campaign",
  get_sales_summary: "reports",
  get_reports: "reports",
};

/** Palavras-chave (pt-BR) por modo — fallback quando não há tool call. */
const KEYWORD_PATTERNS: ReadonlyArray<{
  mode: AgentIntentMode;
  patterns: RegExp[];
}> = [
  {
    mode: "agenda",
    patterns: [
      /\bagenda\b/i,
      /\bcompromissos?\b/i,
      /\breuni(ã|a)o\b/i,
      /\bhor[áa]rio\b/i,
      /\beventos?\b/i,
      /\bcalend[áa]rio\b/i,
      /\bagendament[oa]s?\b/i,
      /\bpr[óo]xim[oa]s?\s+(compromissos?|eventos?|reuni[ãa]o)/i,
    ],
  },
  {
    mode: "finance",
    patterns: [
      /\bsaldo\b/i,
      /\bdinheiro\b/i,
      /\breceitas?\b/i,
      /\bdespesas?\b/i,
      /\bfaturament[oa]\b/i,
      /\bfinanceir[oa]s?\b/i,
      /\bfluxo\s+de\s+caixa\b/i,
      /\blucro\b/i,
      /\bpginao\b/i,
      /\bpagamentos?\b/i,
      /\bcobran[çc]as?\b/i,
      /\bassinatura\b/i,
      /\bplano\b/i,
      /\bconta\b/i,
      /\bproje[çc][ãa]o\b/i,
    ],
  },
  {
    mode: "campaign",
    patterns: [
      /\bcampanhas?\b/i,
      /\bdisparos?\b/i,
      /\bdisparad[oa]s?\b/i,
      /\bmensagem(es)?\s+enviada[so]\b/i,
      /\bdesempenho\b/i,
      /\bconvers[ãa]o\b/i,
      /\btaxa\s+de\s+resposta\b/i,
      /\bcampanha\s+ativa\b/i,
    ],
  },
  {
    mode: "search",
    patterns: [
      /\bpesquis(e|a|ar)\b/i,
      /\bprocure\b/i,
      /\bprocurar\b/i,
      /\bencontre\b/i,
      /\bconsult[ae]\s+(na\s+)?internet\b/i,
      /\bna\s+internet\b/i,
      /\bnot[íi]cias\b/i,
      /\bcota[çc][ãa]o\b/i,
      /\bd[óo]lar\b/i,
      /\bclima\b/i,
      /\btempo\s+agora\b/i,
      /\bprevis[ãa]o\s+do\s+tempo\b/i,
      /\bferiados?\b/i,
    ],
  },
  {
    mode: "leads",
    patterns: [
      /\bleads?\b/i,
      /\bclientes?\b/i,
      /\bprospec[çc][ãa]o\b/i,
      /\bprospectos?\b/i,
      /\bcontatos?\b/i,
    ],
  },
  {
    mode: "reports",
    patterns: [
      /\brelat[óo]rios?\b/i,
      /\bresumo\s+(de\s+)?vendas?\b/i,
      /\bvendas?\b/i,
      /\bn[úu]meros?\b/i,
      /\bdesempenho\s+geral\b/i,
    ],
  },
  {
    // Último nível: palavras temporais só indicam agenda quando nada mais
    // específico foi detectado ("hoje" em "cotação do dólar hoje" ≠ agenda).
    mode: "agenda",
    patterns: [/\bhoje\b/i, /\bamanh[ãa]\b/i],
  },
];

/** Detecta o modo visual a partir do texto do usuário. */
export function detectIntentFromText(text: string): IntentSignal | null {
  if (!text || text.trim().length < 3) return null;
  for (const group of KEYWORD_PATTERNS) {
    for (const pattern of group.patterns) {
      const match = text.match(pattern);
      if (match) {
        return { mode: group.mode, keyword: match[0], source: "user-text" };
      }
    }
  }
  return null;
}

/**
 * Detecta o modo visual a partir das ferramentas realmente executadas pela IA
 * (fonte mais confiável — reflete o que a IA decidiu fazer).
 */
export function detectIntentFromTools(toolNames: string[]): IntentSignal | null {
  for (const name of toolNames) {
    const mode = TOOL_MODE_MAP[name];
    if (mode) {
      return { mode, keyword: name, source: "tool-call" };
    }
  }
  return null;
}

/** Cor principal por modo (hex) — usada pela linha neon e cards. */
export const INTENT_MODE_COLOR: Readonly<Record<AgentIntentMode, string>> = {
  idle: "#00E5FF",
  agenda: "#00E5FF", // cyan
  finance: "#00E5A0", // verde
  campaign: "#A855F7", // roxo
  search: "#008CFF", // azul elétrico
  leads: "#38BDF8",
  reports: "#818CF8",
};

/** Módulo orbital que "acende" para cada modo (IDs do núcleo visual). */
export const INTENT_MODULE_MAP: Readonly<
  Record<Exclude<AgentIntentMode, "idle">, string>
> = {
  agenda: "planeja", // PLANEJA
  finance: "analisa", // ANALISA
  campaign: "executa", // EXECUTA
  search: "pesquisa", // PESQUISA
  leads: "objetivo", // OBJETIVO
  reports: "aprende", // APRENDE
};

/** Rótulo amigável do módulo (para exibição "CANAL ATIVO"). */
export const INTENT_MODULE_LABEL: Readonly<
  Record<Exclude<AgentIntentMode, "idle">, string>
> = {
  agenda: "PLANEJA",
  finance: "ANALISA",
  campaign: "EXECUTA",
  search: "PESQUISA",
  leads: "OBJETIVO",
  reports: "APRENDE",
};

/** Estado do sistema derivado do modo (usado pelo núcleo orbital). */
export function isContextMode(mode: AgentIntentMode): boolean {
  return mode !== "idle";
}
