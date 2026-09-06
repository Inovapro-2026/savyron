"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, AdminBusiness, setSessionToken } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  TRIAL: "bg-cyan-500/15 text-[#00E5FF] border-cyan-500/30 shadow-[0_0_8px_rgba(0,229,255,0.15)]",
  ACTIVE: "bg-emerald-500/15 text-[#00E5A0] border-emerald-500/30 shadow-[0_0_8px_rgba(0,229,160,0.15)]",
  PAST_DUE: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  SUSPENDED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  CANCELLED: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export default function AdminBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const result = await adminApi<AdminBusiness[]>(
        `/admin/businesses${query}`,
      );
      setBusinesses(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar empresas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeStatus = async (id: string, status: string) => {
    if (!window.confirm(`Alterar status da empresa para ${status}?`)) return;
    try {
      await adminApi(`/admin/businesses/${id}/status`, "POST", { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar status");
    }
  };

  const impersonate = async (id: string) => {
    if (impersonating !== id) return;
    try {
      const result = await adminApi<{ token: string }>(
        "/admin/impersonate",
        "POST",
        { business_id: id, reason: reason.trim() },
      );
      await setSessionToken(result.token);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar suporte");
      setImpersonating(null);
    }
  };

  const deleteBusiness = async (id: string, name: string) => {
    const ok = window.confirm(
      `EXCLUIR PERMANENTEMENTE a conta "${name}"? Esta ação remove TODOS os dados da empresa e do banco de dados e NÃO pode ser desfeita. Digite EXCLUIR para confirmar.`,
    );
    if (!ok) return;
    const typed = window.prompt("Digite EXCLUIR para confirmar a exclusão:");
    if (typed !== "EXCLUIR") {
      setError("Exclusão cancelada — digite EXCLUIR para confirmar.");
      return;
    }
    try {
      await adminApi<{ deleted: boolean; users_deleted?: number }>(
        `/admin/businesses/${id}`,
        "DELETE",
      );
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir empresa");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
            Gestão Multi-Tenant
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Empresas Cadastradas</h1>
          <p className="text-sm text-slate-400">
            Gerencie instâncias corporativas, contas, status e acesso de suporte da plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome/slug/e-mail..."
            className="w-72"
          />
          <Button onClick={() => void load()} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
            Buscar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-400 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-5 py-3 text-sm text-slate-400 backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
            Carregando empresas...
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {businesses.map((b) => (
            <Card key={b.id} className="border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold text-white">{b.name}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[b.status] ?? "border-white/10 bg-white/5 text-slate-400"}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    <span className="text-slate-300">{b.email || "sem e-mail"}</span> · slug: <code className="text-[#00E5FF] font-mono">{b.slug}</code>
                    {b.segment ? ` · ${b.segment}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Contatos: <strong className="text-slate-300 font-mono">{b._count.leads}</strong></span>
                    <span>&bull;</span>
                    <span>Conversas: <strong className="text-slate-300 font-mono">{b._count.conversations}</strong></span>
                    <span>&bull;</span>
                    <span>Mensagens: <strong className="text-slate-300 font-mono">{b._count.messages}</strong></span>
                    <span>&bull;</span>
                    <span>Usuários: <strong className="text-slate-300 font-mono">{b._count.members}</strong></span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b.status !== "SUSPENDED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                      onClick={() => changeStatus(b.id, "SUSPENDED")}
                    >
                      Suspender
                    </Button>
                  )}
                  {b.status === "SUSPENDED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => changeStatus(b.id, "ACTIVE")}
                    >
                      Reativar
                    </Button>
                  )}
                  {b.status !== "CANCELLED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                      onClick={() => changeStatus(b.id, "CANCELLED")}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="border border-[#008CFF]/30 bg-[#008CFF]/15 text-[#00E5FF] hover:bg-[#008CFF]/25 shadow-[0_0_12px_rgba(0,140,255,0.2)]"
                    onClick={() =>
                      setImpersonating(impersonating === b.id ? null : b.id)
                    }
                  >
                    Suporte
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteBusiness(b.id, b.name)}
                  >
                    Apagar
                  </Button>
                </div>
              </div>
              {impersonating === b.id && (
                <div className="mt-4 rounded-xl border border-[#008CFF]/30 bg-[#008CFF]/5 p-3.5 backdrop-blur-md">
                  <p className="mb-2 text-xs font-medium text-[#00E5FF]">
                    Modo Suporte: Acessar como {b.name} (sessão auditável, sem expor senha).
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo do suporte (ex.: ticket #1234)"
                      className="flex-1"
                    />
                    <Button size="sm" className="bg-[#008CFF] text-white hover:bg-[#0077DB]" onClick={() => void impersonate(b.id)}>
                      Entrar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 text-slate-300"
                      onClick={() => setImpersonating(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
          {businesses.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-8 text-center text-sm text-slate-500 backdrop-blur-md">
              Nenhuma empresa encontrada com os filtros aplicados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
