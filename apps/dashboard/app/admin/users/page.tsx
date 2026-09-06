"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  AdminUser,
  AdminUserDetail,
  AdminPlan,
  AdminSubscription,
} from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { StatusBadge } from "@/components/admin/status-badge";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // planos + assinaturas (para gerir o plano de cada empresa no modal)
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<Record<string, string>>({});
  const [resetTarget, setResetTarget] = useState<{
    businessId: string;
    name: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // edit fields
  const [role, setRole] = useState<
    "NONE" | "PLATFORM_STAFF" | "PLATFORM_ADMIN"
  >("NONE");
  const [active, setActive] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi<{ users: AdminUser[] }>("/admin/users");
      setUsers(r.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const r = await adminApi<{ plans: AdminPlan[] }>("/admin/plans");
      setPlans(r.plans);
    } catch {
      /* não bloqueia */
    }
  };

  const loadSubs = async () => {
    try {
      const r = await adminApi<AdminSubscription[]>("/admin/subscriptions");
      setSubs(r);
    } catch {
      /* não bloqueia */
    }
  };

  useEffect(() => {
    void load();
    void loadPlans();
    void loadSubs();
  }, []);

  const changePlan = async (businessId: string, planId: string) => {
    if (!planId) return;
    setChangingPlan(businessId);
    setError(null);
    try {
      // Usa o MESMO endpoint canônico de troca de plano de /admin/subscriptions
      // (mantém o status atual da assinatura — ACTIVE continua ACTIVE). Apenas
      // quando a empresa não tem assinatura cai no endpoint administrativo que
      // cria a assinatura e ativa a empresa.
      const sub = subs.find((s) => s.business_id === businessId);
      if (sub) {
        await adminApi(`/admin/subscriptions/${sub.id}/change-plan`, "POST", {
          plan_id: planId,
        });
      } else {
        await adminApi(`/admin/businesses/${businessId}/change-plan`, "POST", {
          plan_id: planId,
        });
      }
      await loadSubs();
      setPendingPlan((p) => ({ ...p, [businessId]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao trocar plano");
    } finally {
      setChangingPlan(null);
    }
  };

  const resetBusiness = async () => {
    if (!resetTarget) return;
    setResetting(true);
    setError(null);
    try {
      const r = await adminApi<{
        leads: number;
        messages: number;
        conversations: number;
        campaigns: number;
        prospections: number;
        jobs_removed: number;
      }>(
        `/admin/businesses/${resetTarget.businessId}/reset`,
        "POST",
        { confirm: "EXCLUIR" },
      );
      window.alert(
        `Empresa "${resetTarget.name}" resetada:\n• ${r.leads} leads\n• ${r.messages} mensagens\n• ${r.conversations} conversas\n• ${r.campaigns} campanhas\n• ${r.prospections} prospecções\n• ${r.jobs_removed} jobs removidos das filas`,
      );
      setResetTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao resetar conta");
    } finally {
      setResetting(false);
    }
  };

  const openDetail = async (u: AdminUser) => {
    setSelected(u);
    setRole(u.platform_role as "NONE" | "PLATFORM_STAFF" | "PLATFORM_ADMIN");
    setActive(u.active);
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const r = await adminApi<{ user: AdminUserDetail }>(
        `/admin/users/${u.id}`,
      );
      setDetail(r.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar detalhes");
    } finally {
      setDetailLoading(false);
    }
  };

  const saveUser = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi(`/admin/users/${selected.id}`, "PATCH", {
        platform_role: role,
        active,
      });
      await load();
      await openDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await adminApi("/admin/users", "POST", {
        name: newName,
        email: newEmail,
        password: newPassword,
        platform_role: newAdmin ? "PLATFORM_ADMIN" : "NONE",
      });
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewAdmin(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#008CFF]/10 border border-[#008CFF]/25 text-[11px] font-semibold text-[#00E5FF] mb-2 uppercase tracking-wider">
            Identidade & Controle de Acesso
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Usuários da Plataforma</h1>
          <p className="text-sm text-slate-400">
            Gerenciamento de contas, papéis de suporte, administradores e empresas associadas.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate((s) => !s)}
          className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold shadow-[0_0_15px_rgba(0,140,255,0.2)]"
        >
          {showCreate ? "Cancelar" : "Novo Usuário"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-400 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {showCreate && (
        <Card className="border border-white/10 bg-[#080D18]/90 p-6 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <h3 className="mb-4 text-base font-bold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00E5FF] animate-pulse" />
            Cadastrar Novo Usuário
          </h3>
          <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nome"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              label="E-mail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <label className="flex items-center gap-2.5 self-end pb-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newAdmin}
                onChange={(e) => setNewAdmin(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#020409] accent-[#7C3CFF]"
              />
              Administrador da Plataforma (Role PLATFORM_ADMIN)
            </label>
            <div className="sm:col-span-2 pt-2">
              <Button type="submit" loading={creating} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
                Criar Usuário
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#080D18]/80 px-5 py-3 text-sm text-slate-400 backdrop-blur-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
            Carregando usuários...
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => void openDetail(u)}
              className="block w-full text-left transition-transform hover:-translate-y-0.5"
            >
              <Card className="flex items-center justify-between border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                <div>
                  <div className="text-base font-bold text-white">{u.name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    <span className="text-slate-300">{u.email}</span> · criado em{" "}
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  {!u.active ? (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.15)]">
                      desativada
                    </span>
                  ) : null}
                  <StatusBadge status={u.platform_role} />
                </div>
              </Card>
            </button>
          ))}
          {users.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-8 text-center text-sm text-slate-500 backdrop-blur-md">
              Nenhum usuário cadastrado.
            </div>
          )}
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected ? `Editar Usuário — ${selected.name}` : "Editar Usuário"
        }
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/10 text-slate-300" onClick={() => setSelected(null)}>
              Fechar
            </Button>
            <Button onClick={() => void saveUser()} loading={saving} className="bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-semibold">
              Salvar Alterações
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {detailLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#008CFF] border-t-transparent" />
                Carregando detalhes...
              </div>
            </div>
          ) : (
            detail && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">E-mail</div>
                    <div className="mt-1 font-mono text-xs font-bold text-white">{detail.email}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Criado em</div>
                    <div className="mt-1 font-mono text-xs text-slate-300">
                      {new Date(detail.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3.5">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Papel na Plataforma</label>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-[#080D18] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#008CFF]/60"
                      value={role}
                      onChange={(e) => setRole(e.target.value as typeof role)}
                    >
                      <option value="NONE" className="bg-[#080D18]">NONE — usuário comum</option>
                      <option value="PLATFORM_STAFF" className="bg-[#080D18]">
                        PLATFORM_STAFF — suporte (leitura)
                      </option>
                      <option value="PLATFORM_ADMIN" className="bg-[#080D18]">
                        PLATFORM_ADMIN — administrador
                      </option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {selected?.id && role !== selected.platform_role ? (
                        <span className="text-amber-400">
                          Atenção: você não pode se rebaixar se for o último admin. Alteração é auditada.
                        </span>
                      ) : (
                        "Alteração registrada no log de auditoria global."
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3.5">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">Status da Conta</label>
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-[#020409] accent-[#00E5A0]"
                      />
                      <span className={`text-sm font-semibold ${active ? "text-[#00E5A0]" : "text-rose-400"}`}>
                        {active ? "Ativa" : "Desativada"}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Contas desativadas não conseguem autenticar ou emitir tokens.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Empresas Vinculadas ao Usuário
                  </div>
                  {detail.memberships.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#020409]/50 p-4 text-center text-xs text-slate-500">
                      Nenhuma empresa vinculada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.memberships.map((m) => {
                        const sub = subs.find(
                          (s) => s.business_id === m.business.id,
                        );
                        const currentPlan = plans.find(
                          (p) => p.name === sub?.plan_name,
                        );
                        return (
                          <div
                            key={m.id}
                            className="rounded-xl border border-white/10 bg-[#020409]/70 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-white">
                                  {m.business.name}
                                </span>
                                <span className="ml-2 font-mono text-[11px] text-[#00E5FF]">
                                  {m.business.slug}
                                </span>
                              </div>
                              <StatusBadge status={m.role} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-end gap-2.5">
                              <div className="min-w-[220px] flex-1">
                                <label className="mb-1 block text-xs font-medium text-slate-400">
                                  Plano da Empresa
                                </label>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="w-full rounded-xl border border-white/10 bg-[#080D18] px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#008CFF]/60"
                                    value={
                                      pendingPlan[m.business.id] ??
                                      currentPlan?.id ??
                                      ""
                                    }
                                    disabled={
                                      changingPlan === m.business.id ||
                                      plans.length === 0
                                    }
                                    onChange={(e) =>
                                      setPendingPlan((p) => ({
                                        ...p,
                                        [m.business.id]: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="" className="bg-[#080D18]">Sem plano</option>
                                    {plans.map((p) => (
                                      <option key={p.id} value={p.id} className="bg-[#080D18]">
                                        {p.name} — R${" "}
                                        {p.price.toFixed(2).replace(".", ",")}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0 border-[#008CFF]/30 text-[#00E5FF] hover:bg-[#008CFF]/15"
                                    disabled={
                                      !pendingPlan[m.business.id] ||
                                      pendingPlan[m.business.id] ===
                                        (currentPlan?.id ?? "") ||
                                      changingPlan === m.business.id
                                    }
                                    loading={changingPlan === m.business.id}
                                    onClick={() =>
                                      void changePlan(
                                        m.business.id,
                                        pendingPlan[m.business.id],
                                      )
                                    }
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Selecione o plano e clique em Aplicar para trocar imediatamente.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setResetTarget({
                                    businessId: m.business.id,
                                    name: m.business.name,
                                  })
                                }
                              >
                                Resetar Conta
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(resetTarget)}
        title="Resetar conta da empresa"
        confirmText="EXCLUIR"
        confirmLabel="Resetar"
        loading={resetting}
        onCancel={() => setResetTarget(null)}
        onConfirm={() => void resetBusiness()}
        message={
          <span>
            Resetar todos os dados da empresa{" "}
            <strong className="text-white">
              {resetTarget?.name}
            </strong>
            ? Leads, campanhas, conversas, mensagens, opt-outs, eventos e
            gerações de IA desta empresa serão{" "}
            <strong className="text-rose-400 font-bold">
              apagados permanentemente
            </strong>
            . A conta de login e a empresa continuam existindo. A sessão do
            WhatsApp será encerrada e jobs pendentes serão removidos. Digite{" "}
            <strong className="text-[#00E5FF] font-mono">EXCLUIR</strong> para confirmar.
          </span>
        }
      />
    </div>
  );
}
