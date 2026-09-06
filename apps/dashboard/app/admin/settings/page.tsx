"use client";

import { useEffect, useState } from "react";
import { adminApi, SettingRow, AdminApiKey } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Plus, Trash2, RotateCcw } from "lucide-react";

const PROVIDERS: Array<{ id: string; label: string }> = [
  { id: "elevenlabs", label: "ElevenLabs" },
  { id: "groq", label: "Groq" },
  { id: "openai", label: "OpenAI" },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // --- Chaves de API ---
  const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState("elevenlabs");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi<{ settings: SettingRow[] }>("/admin/settings");
      setSettings(r.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeys = async () => {
    setError(null);
    try {
      const r = await adminApi<{ keys: AdminApiKey[] }>("/admin/api-keys");
      setApiKeys(r.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar chaves de API");
    }
  };

  useEffect(() => {
    void load();
    void loadApiKeys();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi("/admin/settings", "PATCH", { key, value });
      setKey("");
      setValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (k: string) => {
    setSaving(true);
    setError(null);
    try {
      await adminApi("/admin/settings", "PATCH", { key: k, value: editValue });
      setEditingKey(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (k: string) => {
    if (!window.confirm(`Remover a chave "${k}"?`)) return;
    setError(null);
    try {
      await adminApi(`/admin/settings/${encodeURIComponent(k)}`, "DELETE");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover");
    }
  };

  const addApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setError(null);
    try {
      await adminApi("/admin/api-keys", "POST", {
        provider: newKeyProvider,
        key: newKeyValue,
        label: newKeyLabel,
      });
      setNewKeyLabel("");
      setNewKeyValue("");
      await loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar chave");
    } finally {
      setSavingKey(false);
    }
  };

  const removeApiKey = async (id: string) => {
    if (!window.confirm("Remover esta chave de API?")) return;
    setError(null);
    try {
      await adminApi(`/admin/api-keys/${id}`, "DELETE");
      await loadApiKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover chave");
    }
  };

  const reactivateApiKey = async (id: string) => {
    setError(null);
    try {
      await adminApi(`/admin/api-keys/${id}/status`, "PATCH", { status: "ACTIVE" });
      await loadApiKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reativar chave");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
          Infraestrutura & Provedores
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Configurações Globais</h1>
        <p className="text-sm text-slate-400">
          Chaves criptografadas de provedores de IA e variáveis de runtime da plataforma.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-400 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {/* Chaves de API */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#008CFF]/30 bg-[#008CFF]/15 text-[#00E5FF]">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pool de Chaves de API (IA & Voz)</h2>
            <p className="text-xs text-slate-400">
              Chaves usadas pelo Agente de Voz (ElevenLabs, Groq, OpenAI). Rotação automática em caso de rate limit.
            </p>
          </div>
        </div>

        <Card className="border border-white/10 bg-[#080D18]/90 p-5 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <form
            onSubmit={addApiKey}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="sm:w-48">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Provedor</label>
              <select
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#080D18]">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Input
                label="Rótulo (opcional)"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="ex.: Chave Principal Produção"
              />
            </div>
            <div className="flex-[2]">
              <Input
                label="Valor da Chave"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk_... (criptografada em repouso)"
                type="password"
                autoComplete="off"
                required
              />
            </div>
            <Button type="submit" loading={savingKey} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar Chave
            </Button>
          </form>
        </Card>

        {apiKeys.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 text-sm text-slate-400 backdrop-blur-md">
            Nenhuma chave de API adicional cadastrada no banco. As chaves do arquivo <code className="font-mono text-[#00E5FF]">.env</code> continuam ativas como fallback global.
          </div>
        ) : (
          <div className="space-y-3">
            {PROVIDERS.map((provider) => {
              const keys = apiKeys.filter((k) => k.provider === provider.id);
              if (keys.length === 0) return null;
              return (
                <Card key={provider.id} className="border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md">
                  <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF]" />
                    {provider.label}
                  </div>
                  <div className="space-y-2.5">
                    {keys.map((k) => (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#020409]/60 p-4 transition-all hover:border-white/20"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <code className="font-mono text-sm font-bold text-cyan-300">
                              •••• {k.key_suffix}
                            </code>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                k.status === "ACTIVE"
                                  ? "border-[#00E5A0]/30 bg-[#00E5A0]/10 text-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.15)]"
                                  : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {k.status === "ACTIVE" ? "Ativa" : "Esgotada"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {k.label ? <span className="text-slate-200">{k.label} · </span> : ""}cadastrada em{" "}
                            {new Date(k.created_at).toLocaleDateString("pt-BR")}
                          </div>
                          {k.last_error ? (
                            <div className="mt-1 max-w-md truncate font-mono text-[11px] text-rose-400">
                              {k.last_error}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {k.status !== "ACTIVE" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#00E5A0]/30 text-[#00E5A0] hover:bg-[#00E5A0]/10"
                              onClick={() => void reactivateApiKey(k.id)}
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reativar
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => void removeApiKey(k.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Configurações chave/valor genéricas */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white">Parâmetros de Runtime (Chave / Valor)</h2>
          <p className="text-xs text-slate-400">
            Flags e variáveis globais da plataforma armazenadas de forma dinâmica.
          </p>
        </div>

        <Card className="border border-white/10 bg-[#080D18]/90 p-5 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <form
            onSubmit={save}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Input
                label="Chave"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="ex.: default_whatsapp_daily_limit"
                required
              />
            </div>
            <div className="flex-1">
              <Input
                label="Valor"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="ex.: 50"
                required
              />
            </div>
            <Button type="submit" loading={saving} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
              Salvar Parâmetro
            </Button>
          </form>
        </Card>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
              Carregando configurações...
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {settings.map((s) => (
              <Card key={s.key} className="border border-white/10 bg-[#080D18]/80 p-4 backdrop-blur-md transition-all hover:border-white/20">
                {editingKey === s.key ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <div className="mb-1 text-xs font-mono font-bold text-[#00E5FF]">{s.key}</div>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-[#008CFF] text-white"
                        onClick={() => void saveEdit(s.key)}
                        loading={saving}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-slate-300"
                        onClick={() => setEditingKey(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <code className="font-mono text-xs font-bold text-[#00E5FF]">{s.key}</code>
                      <div className="mt-0.5 truncate font-mono text-sm text-slate-200">
                        {s.value}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-slate-300 hover:bg-white/5"
                        onClick={() => {
                          setEditingKey(s.key);
                          setEditValue(s.value);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => void remove(s.key)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
            {settings.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 text-center text-sm text-slate-500 backdrop-blur-md">
                Nenhum parâmetro de runtime cadastrado.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
