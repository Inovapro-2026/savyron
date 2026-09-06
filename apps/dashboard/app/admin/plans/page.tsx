"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminPlan, AdminPlanFeature } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const brl = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const parsePrice = (v: string): number | null => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const FEATURE_LABELS: Record<string, string> = {
  max_users: "Usuários",
  max_contacts: "Contatos",
  max_conversations: "Conversas",
  max_messages: "Mensagens",
  max_agents: "Agentes de IA",
  max_whatsapp_connections: "Conexões de WhatsApp",
  max_automations: "Automações",
  max_knowledge_items: "Itens de conhecimento",
  max_storage: "Armazenamento (GB)",
  max_ai_usage: "Uso de IA",
  prospeccao_web: "Prospecção web",
  whatsapp_group_extraction: "Extração de grupos do WhatsApp",
};

const featureLabel = (key: string) => FEATURE_LABELS[key] ?? key;

interface PlanForm {
  name: string;
  slug: string;
  price: string;
  description: string;
  billing_interval: "MONTHLY" | "YEARLY";
  trial_days: string;
  active: boolean;
  sort_order: string;
  stripe_product_id: string;
  stripe_price_id: string;
  features: AdminPlanFeature[];
}

const emptyForm = (): PlanForm => ({
  name: "",
  slug: "",
  price: "0",
  description: "",
  billing_interval: "MONTHLY",
  trial_days: "0",
  active: true,
  sort_order: "0",
  stripe_product_id: "",
  stripe_price_id: "",
  features: [],
});

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi<{ plans: AdminPlan[] }>("/admin/plans");
      setPlans(result.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar planos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openEdit = (p: AdminPlan) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      price: String(p.price),
      description: p.description ?? "",
      billing_interval: p.billing_interval === "YEARLY" ? "YEARLY" : "MONTHLY",
      trial_days: String(p.trial_days ?? 0),
      active: p.active,
      sort_order: String(p.sort_order ?? 0),
      stripe_product_id: p.stripe_product_id ?? "",
      stripe_price_id: p.stripe_price_id ?? "",
      features: p.features.map((f) => ({ ...f })),
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      price: "39.9",
      features: [
        { feature: "max_users", enabled: true, limit: null },
        { feature: "max_contacts", enabled: true, limit: null },
        { feature: "max_conversations", enabled: true, limit: null },
        { feature: "max_messages", enabled: true, limit: null },
      ],
    });
  };

  const setFeature = (i: number, patch: Partial<AdminPlanFeature>) => {
    setForm((f) => ({
      ...f,
      features: f.features.map((feat, idx) =>
        idx === i ? { ...feat, ...patch } : feat,
      ),
    }));
  };

  const addFeature = () => {
    setForm((f) => ({
      ...f,
      features: [...f.features, { feature: "", enabled: true, limit: null }],
    }));
  };

  const removeFeature = (i: number) => {
    setForm((f) => ({
      ...f,
      features: f.features.filter((_, idx) => idx !== i),
    }));
  };

  const persist = async () => {
    setSaving(true);
    setError(null);
    const price = parsePrice(form.price);
    if (price === null) {
      setError("Preço inválido. Use ponto ou vírgula decimal (ex.: 59,90).");
      setSaving(false);
      return;
    }
    const payload = {
      name: form.name,
      slug: form.slug,
      price,
      description: form.description,
      billing_interval: form.billing_interval,
      trial_days: Number(form.trial_days || 0),
      active: form.active,
      sort_order: Number(form.sort_order || 0),
      stripe_product_id: form.stripe_product_id || null,
      stripe_price_id: form.stripe_price_id || null,
      features: form.features,
    };
    try {
      if (editingId) {
        await adminApi(`/admin/plans/${editingId}`, "PATCH", payload);
      } else {
        await adminApi("/admin/plans", "POST", payload);
      }
      setEditingId(null);
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar plano");
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void persist();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
            Precificação & Assinaturas
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Planos Comerciais</h1>
          <p className="text-sm text-slate-400">
            Gerencie os planos da plataforma. Alterações valem para <strong>novas</strong> assinaturas.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setCreating((c) => !c);
            openCreate();
          }}
          disabled={creating}
          className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold shadow-[0_0_15px_rgba(0,140,255,0.25)]"
        >
          {creating ? "Cancelar" : "Novo Plano"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-400 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {creating && (
        <Card className="border border-white/10 bg-[#080D18]/90 p-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <h3 className="mb-4 text-base font-bold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse" />
            Cadastrar Novo Plano
          </h3>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              placeholder="ex.: enterprise"
            />
            <Input
              label="Preço mensal (R$)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              inputMode="decimal"
              required
            />
            <Input
              label="Dias de trial"
              value={form.trial_days}
              onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
              inputMode="numeric"
            />
            <Input
              label="Descrição"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <label className="flex items-center gap-2.5 self-end pb-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-[#020409] accent-[#00E5A0]"
              />
              Plano ativo para novas contratações
            </label>
            <div className="sm:col-span-2 space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Recursos e Limites</span>
              <div className="flex flex-wrap gap-2.5">
                {form.features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#020409]/70 px-3.5 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={(e) =>
                        setFeature(i, { enabled: e.target.checked })
                      }
                      className="accent-[#00E5A0]"
                    />
                    <span className="w-40 shrink-0 text-xs font-medium text-slate-300">
                      {featureLabel(f.feature) || "Nova feature"}
                    </span>
                    <Input
                      value={f.feature}
                      onChange={(e) => setFeature(i, { feature: e.target.value })}
                      className="w-40"
                      placeholder="chave da feature"
                    />
                    <Input
                      value={f.limit ?? ""}
                      onChange={(e) =>
                        setFeature(i, {
                          limit:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-24"
                      placeholder="limite"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(i)}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      remover
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFeature}
                  className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-[#00E5FF] hover:bg-white/10"
                >
                  + Adicionar Recurso
                </button>
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <Button type="submit" loading={saving} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
                Salvar Plano
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/10 text-slate-300"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-5 py-3 text-sm text-slate-400 backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
            Carregando planos...
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-[#008CFF]/30 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-white">
                  {plan.name}
                </div>
                {plan.active ? (
                  <span className="rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.15)]">
                    ativo
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    inativo
                  </span>
                )}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-white">
                {brl(plan.price)}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  /{plan.billing_interval === "YEARLY" ? "ano" : "mês"}
                </span>
              </div>
              {plan.description ? (
                <div className="mt-1.5 text-xs text-slate-400">
                  {plan.description}
                </div>
              ) : null}
              <div className="mt-2 text-[11px] text-slate-500 font-mono">
                slug: <span className="text-[#00E5FF]">{plan.slug}</span> · {plan.features.length}{" "}
                {plan.features.length === 1 ? "recurso" : "recursos"}
              </div>
              <div className="mt-4 flex-1 space-y-1.5 border-t border-white/10 pt-3">
                {plan.features.slice(0, 6).map((f) => (
                  <div
                    key={f.feature}
                    className="flex items-center justify-between text-xs"
                  >
                    <span
                      className={
                        f.enabled
                          ? "text-slate-300"
                          : "text-slate-600 line-through"
                      }
                    >
                      {featureLabel(f.feature)}
                    </span>
                    <span className="font-mono text-[11px] text-[#00E5FF]">
                      {f.limit != null ? f.limit : "∞"}
                    </span>
                  </div>
                ))}
                {plan.features.length > 6 ? (
                  <div className="text-[11px] text-slate-500">
                    +{plan.features.length - 6}{" "}
                    {plan.features.length - 6 === 1 ? "recurso" : "recursos"}
                  </div>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 w-full border-white/10 text-slate-300 hover:border-[#008CFF]/40 hover:bg-[#008CFF]/10 hover:text-[#00E5FF]"
                onClick={() => openEdit(plan)}
              >
                Editar Plano
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Editar Plano Comercial"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10 text-slate-300" onClick={() => setEditingId(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void persist()} loading={saving} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
              Salvar Alterações
            </Button>
          </div>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço (R$)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              inputMode="decimal"
              required
            />
            <Input
              label="Dias de trial"
              value={form.trial_days}
              onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
              inputMode="numeric"
            />
          </div>
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stripe Product ID"
              value={form.stripe_product_id}
              onChange={(e) =>
                setForm({ ...form, stripe_product_id: e.target.value })
              }
              placeholder="prod_..."
            />
            <Input
              label="Stripe Price ID"
              value={form.stripe_price_id}
              onChange={(e) =>
                setForm({ ...form, stripe_price_id: e.target.value })
              }
              placeholder="price_..."
            />
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Intervalo</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
                value={form.billing_interval}
                onChange={(e) =>
                  setForm({
                    ...form,
                    billing_interval: e.target.value as "MONTHLY" | "YEARLY",
                  })
                }
              >
                <option value="MONTHLY" className="bg-[#080D18]">Mensal</option>
                <option value="YEARLY" className="bg-[#080D18]">Anual</option>
              </select>
            </div>
            <label className="flex items-center gap-2.5 pb-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-[#020409] accent-[#00E5A0]"
              />
              Plano ativo
            </label>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Recursos e Limites
              </span>
              <button
                type="button"
                onClick={addFeature}
                className="text-xs font-semibold text-[#00E5FF] hover:underline"
              >
                + Adicionar
              </button>
            </div>
            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {form.features.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) =>
                      setFeature(i, { enabled: e.target.checked })
                    }
                    className="accent-[#00E5A0]"
                  />
                  <span className="w-36 shrink-0 text-xs font-medium text-slate-300 truncate">
                    {featureLabel(f.feature) || "Nova feature"}
                  </span>
                  <Input
                    value={f.feature}
                    onChange={(e) => setFeature(i, { feature: e.target.value })}
                    className="flex-1"
                    placeholder="chave da feature"
                  />
                  <Input
                    value={f.limit ?? ""}
                    onChange={(e) =>
                      setFeature(i, {
                        limit:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-20"
                    placeholder="limite"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => removeFeature(i)}
                    className="text-xs text-slate-500 hover:text-rose-400"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
