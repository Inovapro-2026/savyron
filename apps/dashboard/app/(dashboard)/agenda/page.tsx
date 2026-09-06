"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardShell } from "@/components/layout/shell";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Repeat, Trash2, Edit3, X, AlertCircle } from "lucide-react";

const API_BASE = "/api/proxy";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  category: string | null;
  priority: string;
  status: string;
  recurrence: string;
  reminder_minutes_before: number | null;
}

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  recurring: boolean;
  recurrence: string;
  status: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-500/10 text-slate-300 border border-slate-500/20",
  NORMAL: "bg-[#008CFF]/10 text-[#00E5FF] border border-[#008CFF]/30 shadow-[0_0_8px_rgba(0,229,255,0.15)]",
  HIGH: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  URGENT: "bg-[#FF3366]/10 text-[#FF3366] border border-[#FF3366]/30 shadow-[0_0_10px_rgba(255,51,102,0.25)]",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  CONFIRMED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  COMPLETED: "bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20 shadow-[0_0_8px_rgba(0,229,160,0.2)]",
  CANCELLED: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function EventModal({ event, onClose, onSave, onDelete }: {
  event?: CalendarEvent | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : defaultDate);
  const [endDate, setEndDate] = useState(event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [category, setCategory] = useState(event?.category ?? "");
  const [priority, setPriority] = useState(event?.priority ?? "NORMAL");
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? "NONE");
  const [reminder, setReminder] = useState(event?.reminder_minutes_before ?? 15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Título é obrigatório"); return; }
    setSaving(true);
    setError("");
    try {
      const startISO = new Date(startDate).toISOString();
      const endISO = endDate ? new Date(endDate).toISOString() : null;
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startISO,
        end_date: endISO,
        all_day: allDay,
        category: category || null,
        priority,
        recurrence,
        reminder_minutes_before: reminder ? Number(reminder) : null,
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-[#080D18]/95 p-6 shadow-2xl border border-white/10 backdrop-blur-xl text-white" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
            {event ? "Editar evento" : "Novo evento"}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Título</label>
            <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF] focus:ring-1 focus:ring-[#008CFF]" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do evento" required />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Descrição</label>
            <textarea className="input w-full min-h-[80px] resize-y bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF] focus:ring-1 focus:ring-[#008CFF]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Data e hora</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white focus:border-[#008CFF]" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Término (opcional)</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white focus:border-[#008CFF]" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 py-1">
            <input type="checkbox" id="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-[#020409] accent-[#008CFF]" />
            <label htmlFor="allDay" className="text-sm text-slate-300 select-none cursor-pointer">Dia inteiro</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Categoria</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: reunião, tarefa" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Prioridade</label>
              <select className="input w-full bg-[#020409]/70 border-white/10 text-white focus:border-[#008CFF]" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW" className="bg-[#080D18]">Baixa</option>
                <option value="NORMAL" className="bg-[#080D18]">Normal</option>
                <option value="HIGH" className="bg-[#080D18]">Alta</option>
                <option value="URGENT" className="bg-[#080D18]">Urgente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Lembrete (min)</label>
              <input className="input w-full bg-[#020409]/70 border-white/10 text-white placeholder-slate-500 focus:border-[#008CFF]" type="number" value={reminder} onChange={(e) => setReminder(Number(e.target.value))} placeholder="15" min={0} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-white/5">
            <button type="submit" disabled={saving} className="btn-primary flex-1 shadow-[0_0_15px_rgba(0,140,255,0.35)]">{saving ? "Salvando..." : "Salvar"}</button>
            {event && onDelete && (
              <button type="button" onClick={() => { if (confirm("Remover este evento?")) onDelete(event.id); }} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-slate-300 hover:bg-white/10 transition-colors">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "month">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"events" | "reminders">("events");
  const [refreshKey, setRefreshKey] = useState(0);

  const doFetchEvents = useCallback(async () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const res = await fetch(`${API_BASE}/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    const data = await res.json();
    if (data.success) setEvents(data.data.events ?? []);
  }, [currentMonth]);

  const doFetchReminders = useCallback(async () => {
    const res = await fetch(`${API_BASE}/calendar/reminders`);
    const data = await res.json();
    if (data.success) setReminders(data.data.reminders ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      doFetchEvents().catch(() => { setError("Erro ao carregar eventos"); return; }),
      doFetchReminders().catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [doFetchEvents, doFetchReminders, refreshKey]);

  const handleSave = async (eventData: any) => {
    const url = editingEvent ? `${API_BASE}/calendar/events/${editingEvent.id}` : `${API_BASE}/calendar/events`;
    const method = editingEvent ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventData) });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message ?? "Erro ao salvar");
    setRefreshKey(k => k + 1);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`${API_BASE}/calendar/events/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message ?? "Erro ao remover");
    setRefreshKey(k => k + 1);
  };

  const handleDeleteReminder = async (id: string) => {
    const res = await fetch(`${API_BASE}/calendar/reminders/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message ?? "Erro ao remover lembrete");
    setRefreshKey(k => k + 1);
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const todayEvents = events.filter((e) => {
    const today = new Date();
    const eventDate = new Date(e.start_date);
    return eventDate.toDateString() === today.toDateString();
  });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));

  return (
    <DashboardShell title="Agenda">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Agenda & Compromissos</h1>
              <p className="text-xs text-slate-400">Gerenciamento inteligente de horários e lembretes com sincronização</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-[#080D18]/80 p-1 backdrop-blur-md">
              <button onClick={() => setViewMode("list")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${viewMode === "list" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Lista</button>
              <button onClick={() => setViewMode("month")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${viewMode === "month" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Mês</button>
            </div>
            <button onClick={() => { setEditingEvent(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-xs shadow-[0_0_15px_rgba(0,140,255,0.35)]"><Plus className="h-4 w-4" /> Novo evento</button>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        {todayEvents.length > 0 && (
          <div className="rounded-2xl border border-[#00E5FF]/20 bg-gradient-to-r from-[#008CFF]/10 via-[#080D18]/90 to-[#080D18] p-4 shadow-[0_0_20px_rgba(0,140,255,0.08)] backdrop-blur-xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00E5FF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00E5FF]"></span>
              </span>
              Hoje na Agenda
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {todayEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-sm text-slate-300">
                  <Clock className="h-4 w-4 text-[#00E5FF] shrink-0" />
                  <span className="font-semibold text-white">{formatTime(e.start_date)}</span>
                  <span className="truncate">{e.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1 rounded-xl border border-white/10 bg-[#080D18]/80 p-1 w-fit backdrop-blur-md">
          <button onClick={() => setActiveTab("events")} className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "events" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Eventos</button>
          <button onClick={() => setActiveTab("reminders")} className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === "reminders" ? "bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]" : "text-slate-400 hover:text-white"}`}>Lembretes</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-[#008CFF] border-t-transparent animate-spin" />
              <span className="text-xs uppercase tracking-wider font-semibold">Carregando cronograma...</span>
            </div>
          </div>
        ) : activeTab === "events" ? (
          viewMode === "list" ? (
            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 rounded-2xl border border-white/5 bg-[#080D18]/40">
                  <Calendar className="mb-3 h-12 w-12 text-slate-600" />
                  <p className="text-sm font-medium">Nenhum evento registrado para este mês</p>
                </div>
              ) : events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/5 bg-[#080D18]/80 p-4 backdrop-blur-md hover:border-white/15 hover:bg-[#0C1427]/90 transition-all flex items-start gap-4 shadow-sm">
                  <div className="flex min-w-[64px] flex-col items-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/20 px-3 py-2 shadow-[0_0_10px_rgba(0,140,255,0.08)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5FF]">{new Date(event.start_date).toLocaleDateString("pt-BR", { month: "short" })}</span>
                    <span className="text-2xl font-black text-white">{new Date(event.start_date).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white text-base">{event.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORITY_COLORS[event.priority] ?? PRIORITY_COLORS.NORMAL}`}>{event.priority}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[event.status] ?? ""}`}>{event.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5 text-slate-300"><Clock className="h-3.5 w-3.5 text-[#00E5FF]" />{formatTime(event.start_date)}{event.end_date ? ` - ${formatTime(event.end_date)}` : ""}</span>
                      {event.category && <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">{event.category}</span>}
                      {event.recurrence !== "NONE" && <span className="flex items-center gap-1 text-cyan-400"><Repeat className="h-3.5 w-3.5" />{event.recurrence}</span>}
                    </div>
                    {event.description && <p className="mt-2 text-sm text-slate-400 truncate">{event.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditingEvent(event); setShowModal(true); }} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><Edit3 className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Remover "${event.title}"?`)) handleDelete(event.id); }} className="rounded-xl p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 backdrop-blur-xl overflow-hidden shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
                <button onClick={prevMonth} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                <h3 className="font-bold text-white text-lg capitalize tracking-wide">{currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
                <button onClick={nextMonth} className="rounded-xl p-2 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((d) => <div key={d} className="border-b border-white/10 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.01]">{d}</div>)}
                {calendarDays.map((day, i) => {
                  const dayEvents = day ? events.filter((e) => new Date(e.start_date).toDateString() === day.toDateString()) : [];
                  const isToday = day && day.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} className={`min-h-[110px] border-b border-r border-white/5 p-2 transition-colors ${isToday ? "bg-[#008CFF]/10 border-[#008CFF]/30" : "hover:bg-white/[0.02]"}`}>
                      {day && (
                        <>
                          <div className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all ${isToday ? "bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-extrabold shadow-[0_0_12px_rgba(0,229,255,0.6)]" : "text-slate-300 font-medium"}`}>{day.getDate()}</div>
                          {dayEvents.slice(0, 3).map((e) => (
                            <div key={e.id} onClick={() => { setEditingEvent(e); setShowModal(true); }} className="mb-1 truncate rounded-md bg-[#008CFF]/20 border border-[#008CFF]/30 px-2 py-1 text-[11px] font-semibold text-[#00E5FF] cursor-pointer hover:bg-[#008CFF]/35 hover:shadow-[0_0_8px_rgba(0,229,255,0.3)] transition-all" title={e.title}>
                              {e.all_day ? "" : formatTime(e.start_date) + " "}{e.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && <div className="text-[10px] text-slate-500 font-medium pl-1">+{dayEvents.length - 3} mais</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 rounded-2xl border border-white/5 bg-[#080D18]/40">
                <Clock className="mb-3 h-12 w-12 text-slate-600" />
                <p className="text-sm font-medium">Nenhum lembrete pendente</p>
              </div>
            ) : reminders.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/5 bg-[#080D18]/80 p-4 backdrop-blur-md flex items-center gap-4 hover:border-amber-500/30 hover:bg-[#0C1427]/90 transition-all shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-base">{r.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(r.remind_at).toLocaleDateString("pt-BR")} às {new Date(r.remind_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{r.recurring ? ` · Repete: ${r.recurrence}` : ""}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${r.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 shadow-[0_0_8px_rgba(0,229,160,0.2)]"}`}>{r.status}</span>
                <button onClick={() => { if (confirm(`Remover o lembrete "${r.title}"?`)) handleDeleteReminder(r.id); }} aria-label="Excluir lembrete" title="Excluir lembrete" className="rounded-xl p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <EventModal event={editingEvent} onClose={() => { setShowModal(false); setEditingEvent(null); }} onSave={handleSave} onDelete={handleDelete} />
      )}
    </DashboardShell>
  );
}