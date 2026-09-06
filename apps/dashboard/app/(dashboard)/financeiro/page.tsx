"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/shell";
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Edit3, X, AlertCircle, ArrowUpRight, ArrowDownRight, PiggyBank, CalendarDays } from "lucide-react";

const API_BASE = "/api/proxy";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  date: string;
  category: string | null;
  category_id: string | null;
  status: string;
  recurrence: string;
  notes: string | null;
}

interface FinancialSummary {
  current_month: { income: number; expenses: number; balance: number };
  last_month: { income: number; expenses: number; balance: number };
  planned: { income: number; expenses: number };
  categories: Array<{ id: string; name: string; type: string; color: string | null }>;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TransactionModal({ transaction, onClose, onSave, onDelete }: {
  transaction?: Transaction | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [type, setType] = useState(transaction?.type ?? "EXPENSE");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(transaction ? new Date(transaction.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(transaction?.category ?? "");
  const [recurrence, setRecurrence] = useState(transaction?.recurrence ?? "NONE");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) { setError("Descrição e valor são obrigatórios"); return; }
    const value = parseFloat(amount.replace(",", "."));
    if (isNaN(value) || value <= 0) { setError("Valor inválido"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ type, description: description.trim(), amount: value, date: new Date(date).toISOString(), category: category || null, recurrence, notes: notes.trim() || null });
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#080D18]/95 p-6 shadow-2xl border border-white/10 backdrop-blur-xl text-white" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${type === "INCOME" ? "bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" : "bg-[#FF3366] shadow-[0_0_8px_#FF3366]"}`} />
            {transaction ? "Editar transação" : "Nova transação"}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setType("EXPENSE")} className={`rounded-xl border px-4 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${type === "EXPENSE" ? "border-[#FF3366]/50 bg-[#FF3366]/15 text-[#FF3366] shadow-[0_0_12px_rgba(255,51,102,0.25)]" : "border-white/10 bg-[#020409]/60 text-slate-400 hover:border-white/20"}`}><TrendingDown className="h-4 w-4" />Despesa</button>
            <button type="button" onClick={() => setType("INCOME")} className={`rounded-xl border px-4 py-3 text-center text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${type === "INCOME" ? "border-[#00E5A0]/50 bg-[#00E5A0]/15 text-[#00E5A0] shadow-[0_0_12px_rgba(0,229,160,0.25)]" : "border-white/10 bg-[#020409]/60 text-slate-400 hover:border-white/20"}`}><TrendingUp className="h-4 w-4" />Receita</button>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Descrição</label>
            <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: servidor cloud, mensalidade, consultoria" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Valor (R$)</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Data</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white focus:border-[#008CFF]" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Categoria</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: infraestrutura" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Recorrência</label>
              <select className="input w-full bg-[#020409]/70 border-white/10 text-white focus:border-[#008CFF]" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="NONE" className="bg-[#080D18]">Não recorrente</option>
                <option value="DAILY" className="bg-[#080D18]">Diário</option>
                <option value="WEEKLY" className="bg-[#080D18]">Semanal</option>
                <option value="MONTHLY" className="bg-[#080D18]">Mensal</option>
                <option value="YEARLY" className="bg-[#080D18]">Anual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Observação (opcional)</label>
            <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas..." />
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-white/5">
            <button type="submit" disabled={saving} className="btn-primary flex-1 shadow-[0_0_15px_rgba(0,140,255,0.35)]">{saving ? "Salvando..." : "Salvar"}</button>
            {transaction && onDelete && (
              <button type="button" onClick={() => { if (confirm("Remover esta transação?")) onDelete(transaction.id); }} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-slate-300 hover:bg-white/10 transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [transRes, summRes] = await Promise.all([
        fetch(`${API_BASE}/financial/transactions`),
        fetch(`${API_BASE}/financial/summary`),
      ]);
      const transData = await transRes.json();
      const summData = await summRes.json();
      if (transData.success) setTransactions(transData.data.transactions ?? []);
      if (summData.success) setSummary(summData.data);
    } catch (e) {
      setError("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (data: any) => {
    const url = editingTransaction ? `${API_BASE}/financial/transactions/${editingTransaction.id}` : `${API_BASE}/financial/transactions`;
    const method = editingTransaction ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message ?? "Erro ao salvar");
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${API_BASE}/financial/transactions/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (!result.success) throw new Error(result.error?.message ?? "Erro ao remover");
    await fetchData();
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterType && t.type !== filterType) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const currentBalance = summary ? summary.current_month.balance : 0;
  const currentIncome = summary ? summary.current_month.income : 0;
  const currentExpenses = summary ? summary.current_month.expenses : 0;
  const plannedIncome = summary ? summary.planned.income : 0;
  const plannedExpenses = summary ? summary.planned.expenses : 0;

  return (
    <DashboardShell title="Financeiro">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Gestão Financeira</h1>
              <p className="text-xs text-slate-400">Fluxo de caixa, receitas, despesas operacionais e previsões em tempo real</p>
            </div>
          </div>
          <button onClick={() => { setEditingTransaction(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-xs shadow-[0_0_15px_rgba(0,140,255,0.35)]"><Plus className="h-4 w-4" /> Nova transação</button>
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        <div className="flex gap-1 rounded-xl border border-white/10 bg-[#080D18]/80 p-1 w-fit backdrop-blur-md">
          <button onClick={() => setActiveTab("overview")} className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "overview" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Visão geral</button>
          <button onClick={() => setActiveTab("transactions")} className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "transactions" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Transações</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[#008CFF] border-t-transparent animate-spin" />
              <span className="text-xs uppercase tracking-wider font-semibold">Carregando métricas financeiras...</span>
            </div>
          </div>
        ) : activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#00E5A0]/20 bg-[#080D18]/80 p-5 backdrop-blur-md shadow-[0_0_20px_rgba(0,229,160,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 h-24 w-24 bg-[#00E5A0]/5 rounded-full blur-2xl group-hover:bg-[#00E5A0]/10 transition-all pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Receitas do Mês</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-black text-[#00E5A0] tracking-tight">{formatCurrency(currentIncome)}</p>
                {summary && <p className="mt-1 text-xs text-slate-400">Mês anterior: <span className="text-slate-300 font-semibold">{formatCurrency(summary.last_month.income)}</span></p>}
              </div>

              <div className="rounded-2xl border border-[#FF3366]/20 bg-[#080D18]/80 p-5 backdrop-blur-md shadow-[0_0_20px_rgba(255,51,102,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 h-24 w-24 bg-[#FF3366]/5 rounded-full blur-2xl group-hover:bg-[#FF3366]/10 transition-all pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Despesas do Mês</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF3366]/10 text-[#FF3366] border border-[#FF3366]/20">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-3xl font-black text-[#FF3366] tracking-tight">{formatCurrency(currentExpenses)}</p>
                {summary && <p className="mt-1 text-xs text-slate-400">Mês anterior: <span className="text-slate-300 font-semibold">{formatCurrency(summary.last_month.expenses)}</span></p>}
              </div>

              <div className="rounded-2xl border border-[#008CFF]/20 bg-[#080D18]/80 p-5 backdrop-blur-md shadow-[0_0_20px_rgba(0,140,255,0.06)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 h-24 w-24 bg-[#008CFF]/5 rounded-full blur-2xl group-hover:bg-[#008CFF]/10 transition-all pointer-events-none" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Atual</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#008CFF]/10 text-[#00E5FF] border border-[#008CFF]/20">
                    <PiggyBank className="h-4 w-4" />
                  </div>
                </div>
                <p className={`mt-3 text-3xl font-black tracking-tight ${currentBalance >= 0 ? "text-[#00E5FF] drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]" : "text-[#FF3366]"}`}>{formatCurrency(currentBalance)}</p>
                {summary && <p className="mt-1 text-xs text-slate-400">Mês anterior: <span className="text-slate-300 font-semibold">{formatCurrency(summary.last_month.balance)}</span></p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl shadow-lg">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" />
                  Previsto para este mês
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="flex items-center gap-2 text-sm text-[#00E5A0]"><ArrowUpRight className="h-4 w-4" />Receitas previstas</span>
                    <span className="font-bold text-[#00E5A0]">{formatCurrency(plannedIncome)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="flex items-center gap-2 text-sm text-[#FF3366]"><ArrowDownRight className="h-4 w-4" />Despesas previstas</span>
                    <span className="font-bold text-[#FF3366]">{formatCurrency(plannedExpenses)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-3 mt-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#008CFF]/5">
                      <span className="flex items-center gap-2 text-sm font-semibold text-white"><PiggyBank className="h-4 w-4 text-[#00E5FF]" />Saldo projetado</span>
                      <span className={`font-black text-base ${currentIncome - currentExpenses + plannedIncome - plannedExpenses >= 0 ? "text-[#00E5FF]" : "text-[#FF3366]"}`}>{formatCurrency(currentIncome - currentExpenses + plannedIncome - plannedExpenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl shadow-lg">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#7C3CFF] shadow-[0_0_6px_#7C3CFF]" />
                  Comparação com mês passado
                </h3>
                {summary && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-sm text-slate-300">Receitas</span>
                      <div className="text-right">
                        <span className="block text-sm font-bold text-white">{formatCurrency(summary.last_month.income)}</span>
                        <span className={`text-xs font-semibold ${currentIncome >= summary.last_month.income ? "text-[#00E5A0]" : "text-[#FF3366]"}`}>
                          {currentIncome >= summary.last_month.income ? "↑" : "↓"} {summary.last_month.income > 0 ? Math.abs(((currentIncome - summary.last_month.income) / summary.last_month.income) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-sm text-slate-300">Despesas</span>
                      <div className="text-right">
                        <span className="block text-sm font-bold text-white">{formatCurrency(summary.last_month.expenses)}</span>
                        <span className={`text-xs font-semibold ${currentExpenses <= summary.last_month.expenses ? "text-[#00E5A0]" : "text-[#FF3366]"}`}>
                          {currentExpenses <= summary.last_month.expenses ? "↓" : "↑"} {summary.last_month.expenses > 0 ? Math.abs(((currentExpenses - summary.last_month.expenses) / summary.last_month.expenses) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-white/10 pt-3 mt-2">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02]">
                        <span className="text-sm font-semibold text-slate-300">Saldo mês passado</span>
                        <span className={`font-bold ${summary.last_month.balance >= 0 ? "text-[#00E5FF]" : "text-[#FF3366]"}`}>{formatCurrency(summary.last_month.balance)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {summary && summary.categories.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-5 backdrop-blur-xl">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Categorias Cadastradas</h3>
                <div className="flex flex-wrap gap-2">
                  {summary.categories.map((cat) => (
                    <span key={cat.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-[#00E5FF] transition-all cursor-default">{cat.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select className="rounded-xl border border-white/10 bg-[#080D18] px-3 py-2 text-xs font-semibold text-slate-300 focus:border-[#008CFF] focus:outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="" className="bg-[#080D18]">Todos os tipos</option>
                <option value="INCOME" className="bg-[#080D18]">Receitas</option>
                <option value="EXPENSE" className="bg-[#080D18]">Despesas</option>
              </select>
              <select className="rounded-xl border border-white/10 bg-[#080D18] px-3 py-2 text-xs font-semibold text-slate-300 focus:border-[#008CFF] focus:outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="" className="bg-[#080D18]">Todos os status</option>
                <option value="REAL" className="bg-[#080D18]">Realizado</option>
                <option value="PLANNED" className="bg-[#080D18]">Previsto</option>
              </select>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 rounded-2xl border border-white/5 bg-[#080D18]/40">
                <Wallet className="mb-3 h-12 w-12 text-slate-600" />
                <p className="text-sm font-medium">Nenhuma transação encontrada</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTransactions.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/5 bg-[#080D18]/80 p-4 backdrop-blur-md flex items-center gap-4 hover:border-white/15 hover:bg-[#0C1427]/90 transition-all shadow-sm">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${t.type === "INCOME" ? "bg-[#00E5A0]/10 border border-[#00E5A0]/20 text-[#00E5A0] shadow-[0_0_10px_rgba(0,229,160,0.15)]" : "bg-[#FF3366]/10 border border-[#FF3366]/20 text-[#FF3366] shadow-[0_0_10px_rgba(255,51,102,0.15)]"}`}>
                      {t.type === "INCOME" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white text-base">{t.description}</h3>
                        {t.status === "PLANNED" && <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">Previsto</span>}
                        {t.recurrence !== "NONE" && <span className="rounded-full bg-[#008CFF]/10 border border-[#008CFF]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]">{t.recurrence}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-[#00E5FF]" />{new Date(t.date).toLocaleDateString("pt-BR")}</span>
                        {t.category && <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">{t.category}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-base tracking-tight ${t.type === "INCOME" ? "text-[#00E5A0]" : "text-[#FF3366]"}`}>{t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingTransaction(t); setShowModal(true); }} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Remover "${t.description}"?`)) handleDelete(t.id); }} className="rounded-xl p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <TransactionModal transaction={editingTransaction} onClose={() => { setShowModal(false); setEditingTransaction(null); }} onSave={handleSave} onDelete={handleDelete} />
      )}
    </DashboardShell>
  );
}