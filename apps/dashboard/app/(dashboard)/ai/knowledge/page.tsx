'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search as SearchIcon } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useApi, useApiMutationMethod, request } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string | null;
  active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'PRODUCTS', label: 'Produtos' },
  { value: 'SERVICES', label: 'Serviços' },
  { value: 'PLANS', label: 'Planos' },
  { value: 'PRICES', label: 'Preços' },
  { value: 'PROMOTIONS', label: 'Promoções' },
  { value: 'HOURS', label: 'Horários' },
  { value: 'DAYS', label: 'Dias de atendimento' },
  { value: 'PAYMENT', label: 'Formas de pagamento' },
  { value: 'ADDRESS', label: 'Endereço' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'POLICIES', label: 'Políticas' },
  { value: 'BENEFITS', label: 'Benefícios' },
  { value: 'COMMERCIAL_RULES', label: 'Regras comerciais' },
  { value: 'LINKS', label: 'Links' },
  { value: 'INTERNAL_RULES', label: 'Regras internas' },
];

const FILTERS = [
  { value: 'ALL', label: 'Todos' },
  ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export default function AIKnowledgePage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useApi<{ items: KnowledgeItem[] }>(['ai-knowledge'], 'ai/knowledge');
  const items = data?.items ?? [];

  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('FAQ');
  const [keywords, setKeywords] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-knowledge'] });

  const mutation = useApiMutationMethod({
    onSuccess: () => {
      success('Salvo');
      setCreating(false);
      setEditing(null);
      setTitle('');
      setContent('');
      setCategory('FAQ');
      setKeywords('');
      invalidate();
    },
    onError: (err) => toastError(err.message),
  });

  const toggleActive = async (item: KnowledgeItem) => {
    await mutation.mutateAsync({ _method: 'PATCH', _path: `ai/knowledge/${item.id}`, active: !item.active });
  };

  const remove = async (item: KnowledgeItem) => {
    if (!window.confirm(`Excluir "${item.title}"?`)) return;
    await mutation.mutateAsync({ _method: 'DELETE', _path: `ai/knowledge/${item.id}` });
  };

  const save = async () => {
    const payload = { title, content, category, keywords };
    if (editing) {
      await mutation.mutateAsync({ _method: 'PATCH', _path: `ai/knowledge/${editing.id}`, ...payload });
    } else {
      await mutation.mutateAsync({ _method: 'POST', _path: 'ai/knowledge', ...payload });
    }
  };

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setCategory('FAQ');
    setKeywords('');
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditing(item);
    setCreating(true);
    setTitle(item.title);
    setContent(item.content);
    setCategory(item.category);
    setKeywords(item.keywords ?? '');
  };

  const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'ALL' && it.category !== filter) return false;
      if (!q) return true;
      const hay = `${it.title} ${it.content} ${it.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, search]);

  const total = items.length;
  const active = items.filter((i) => i.active).length;
  const inactive = total - active;

  return (
  return (
    <DashboardShell title="Base de Conhecimento IA">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
            <Plus className="h-5 w-5 rotate-45" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Base de Conhecimento Neural</h1>
            <p className="text-xs text-slate-400">
              O cérebro comercial da sua empresa — catálogo, preços, regras e links indexados para respostas instantâneas da IA
            </p>
          </div>
        </div>

        {/* Contador + busca */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-[#080D18]/80 px-3 py-1 text-slate-400">Total indexado: <strong className="text-white font-bold">{total}</strong></span>
            <span className="rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-3 py-1 text-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.15)] font-semibold">Ativos: <strong>{active}</strong></span>
            <span className="rounded-full border border-white/10 bg-[#080D18]/80 px-3 py-1 text-slate-400">Desativados: <strong className="text-white font-bold">{inactive}</strong></span>
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar conhecimento..."
              className="w-full rounded-xl border border-white/10 bg-[#020409]/70 py-2 pl-9 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-[#008CFF] focus:ring-1 focus:ring-[#008CFF] sm:w-72"
            />
          </div>
        </div>

        {/* Filtros por categoria */}
        <div className="-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          <div className="flex w-max gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                  filter === f.value ? 'bg-[#008CFF]/20 text-[#00E5FF] border border-[#008CFF]/40 shadow-[0_0_10px_rgba(0,140,255,0.2)]' : 'border border-white/5 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl">
          <div className="mb-5 flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                {creating ? (editing ? 'Editar conhecimento' : 'Nova informação') : 'Adicionar informação'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Modo rápido: título + conteúdo + categoria + palavras-chave</p>
            </div>
            {creating ? (
              <Button size="sm" variant="ghost" onClick={() => { setCreating(false); resetForm(); }} className="text-slate-400 hover:text-white">
                Cancelar
              </Button>
            ) : null}
          </div>

          {creating ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Preço do corte de cabelo" />
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Tipo de conhecimento</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2.5 text-sm text-white outline-none focus:border-[#008CFF]">
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-[#080D18]">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Conteúdo</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Ex.: O corte de cabelo custa R$ 25,00 e funciona de terça a sábado, das 09h às 19h." className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#008CFF]" />
              </div>
              <Input label="Palavras-chave (opcional)" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="preço, valor, quanto custa, corte" hint="Separadas por vírgula — aceleram a busca semântica da IA." />
              <Button onClick={() => void save()} loading={mutation.isPending} className="shadow-[0_0_15px_rgba(0,140,255,0.35)]">
                <Plus className="mr-2 h-4 w-4" />
                {editing ? 'Salvar alterações' : 'Adicionar ao Cérebro'}
              </Button>
            </div>
          ) : (
            <div>
              <Button onClick={() => { setCreating(true); resetForm(); }} className="shadow-[0_0_15px_rgba(0,140,255,0.35)]">
                <Plus className="mr-2 h-4 w-4" />
                Nova informação
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-slate-500">
            <span className="text-xs uppercase tracking-wider font-semibold">Carregando base de conhecimento...</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/5 bg-[#080D18]/80 p-5 backdrop-blur-md hover:border-white/15 hover:bg-[#0C1427]/90 transition-all shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-base">{item.title}</span>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">{categoryLabel(item.category)}</span>
                      {item.active ? (
                        <span className="flex items-center gap-1 rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00E5A0] shadow-[0_0_8px_rgba(0,229,160,0.15)]">● Ativo</span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Inativo</span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{item.content}</p>
                    {item.keywords ? <p className="mt-2 text-xs text-slate-500 font-mono">Palavras-chave: {item.keywords}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void toggleActive(item)} className="text-xs">
                      {item.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#080D18]/40 p-12 text-center text-sm text-slate-400 backdrop-blur-md">
            {search || filter !== 'ALL'
              ? 'Nenhum conhecimento encontrado para este filtro/busca.'
              : 'Nenhuma informação cadastrada ainda. Adicione produtos, preços, horários, políticas e links para calibrar a IA.'}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
