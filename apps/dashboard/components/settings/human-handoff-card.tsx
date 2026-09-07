'use client';

import { useEffect, useState } from 'react';
import { Handshake, Save, Check, AlertTriangle, Phone, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useQueryClient } from '@tanstack/react-query';

interface OwnerPhonePayload {
  human_transfer_owner_phone: string | null;
  phone?: string | null;
  whatsapp_connected?: boolean;
}

/**
 * Card "Atendimento humano" — /settings.
 * Número do PROPRIETÁRIO (destinatário das notificações de handoff) —
 * independente do WhatsApp conectado (que atende os clientes).
 * Persistência: PATCH /business/settings (OWNER/BUSINESS_ADMIN).
 */
export function HumanHandoffCard({ whatsappConnected, waPhone }: { whatsappConnected: boolean; waPhone: string | null }) {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/proxy/business/settings');
        const json = await res.json();
        if (!alive) return;
        if (json?.success) {
          setSavedPhone(json.data?.human_transfer_owner_phone ?? null);
          setPhone(json.data?.human_transfer_owner_phone ?? '');
        }
      } catch {
        /* silencioso: card informativo */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/proxy/business/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_transfer_owner_phone: phone.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Falha ao salvar número');
      }
      success('Número do proprietário salvo');
      setSavedPhone(phone.trim() ? phone.trim() : null);
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Falha ao salvar número');
    } finally {
      setSaving(false);
    }
  };

  const configured = Boolean(savedPhone);

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl"
      data-human-handoff-card
    >
      <div className="mb-5 flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7C3CFF]/10 border border-[#7C3CFF]/30 text-[#C084FC] shadow-[0_0_12px_rgba(124,60,255,0.2)]">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Atendimento humano</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Pause automaticamente a IA quando um cliente solicitar falar com uma pessoa.
            </p>
          </div>
        </div>
        {configured ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-3 py-1 text-[11px] font-semibold text-[#00E5A0] sm:self-center">
            <Check className="h-3 w-3" /> Notificações de atendimento humano ativas
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-[#FFB020]/30 bg-[#FFB020]/10 px-3 py-1 text-[11px] font-semibold text-[#FFB020] sm:self-center">
            <AlertTriangle className="h-3 w-3" /> Configure um número para receber as notificações.
          </span>
        )}
      </div>

      {/* Dois números — visualmente distintos */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* WhatsApp de atendimento (somente leitura) */}
        <div className="rounded-xl border border-white/5 bg-[#0C1427]/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <PhoneCall className="h-3.5 w-3.5 text-[#00E5FF]" /> WhatsApp de atendimento
          </div>
          <div className="mt-1.5 text-sm font-semibold text-white">
            {waPhone ? waPhone : 'Número conectado'}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${whatsappConnected ? 'bg-[#00E5A0] shadow-[0_0_6px_#00E5A0]' : 'bg-slate-500'}`} />
            {whatsappConnected ? 'Número conectado (atende os clientes)' : 'Desconectado'}
          </div>
        </div>

        {/* Número do proprietário (editável) */}
        <div className="rounded-xl border border-white/5 bg-[#0C1427]/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Phone className="h-3.5 w-3.5 text-[#C084FC]" /> Número do proprietário
          </div>
          <div className="mt-1.5 text-sm font-semibold text-white">
            {savedPhone ? savedPhone : '—'}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${configured ? 'bg-[#C084FC] shadow-[0_0_6px_#C084FC]' : 'bg-slate-500'}`} />
            {configured ? 'Recebe notificações de handoff' : 'Sem notificações'}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Número do proprietário"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 (11) 99999-9999"
            hint="Celular com DDD. Formatos aceitos: (11) 99999-9999, 11 99999-9999, 5511999999999, +5511999999999."
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
        </div>
        <Button onClick={() => void save()} loading={saving} className="shrink-0">
          <Save className="h-4 w-4" /> Salvar número
        </Button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Este número é apenas o DESTINATÁRIO das notificações — não altera o WhatsApp conectado, o QR Code nem a sessão.
        Quando um cliente pedir para falar com uma pessoa, a IA da conversa é pausada e você recebe o alerta aqui.
      </p>
    </div>
  );
}
