/**
 * Utilitários de mesclagem/deduplicação de mensagens do chat.
 *
 * A deduplicação é feita pelo IDENTIFICADOR REAL da mensagem:
 *  - `external_id` (ID do WhatsApp/SMS no provider) — a fonte da verdade para
 *    uma mensagem recebida/enviada.
 *  - `id` (cuid do banco) — identidade da linha persistida.
 *
 * REGRAS:
 *  - NUNCA deduplicar pelo texto/conteúdo (duas campanhas podem enviar o mesmo
 *    template e são legítimas).
 *  - Preservar a ordem cronológica.
 *  - Se um dado `external_id` aparecer em duas linhas (indicando uma duplicata
 *    real de persistência), mantém a linha mais recente/hidratada e descarta o
 *    resto.
 */
export interface MergeableMessage {
  id: string;
  external_id?: string | null;
  created_at: string;
}

/**
 * Junta uma lista existente com mensagens recém-chegadas, preservando
 * unicidade por `id` e `external_id` e mantendo a ordem por `created_at`.
 */
export function mergeMessages<T extends MergeableMessage>(existing: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  const byExternal = new Map<string, T>();

  const upsert = (m: T) => {
    byId.set(m.id, m);
    if (m.external_id) byExternal.set(m.external_id, m);
  };

  for (const m of existing) upsert(m);
  for (const m of incoming) {
    // Mesma linha (mesmo id) → sobrescreve com a versão mais recente.
    if (byId.has(m.id)) { byId.set(m.id, m); if (m.external_id) byExternal.set(m.external_id, m); }
    else if (m.external_id && byExternal.has(m.external_id)) {
      // Duplicata real por external_id → mantém aquele já presente (primeiro).
      continue;
    } else upsert(m);
  }

  return [...byId.values()].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
}

/** Remove da lista qualquer linha cujo `external_id` esteja duplicado. */
export function dedupeByExternalId<T extends MergeableMessage>(messages: T[]): T[] {
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  const out: T[] = [];
  for (const m of messages) {
    if (seenIds.has(m.id)) continue;
    if (m.external_id) {
      if (seen.has(m.external_id)) continue;
      seen.add(m.external_id);
    }
    seenIds.add(m.id);
    out.push(m);
  }
  return out;
}
