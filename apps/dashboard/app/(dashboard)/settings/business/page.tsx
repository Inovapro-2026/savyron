'use client';

import { useState } from 'react';
import { Save, Building2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useApi, useApiMutationMethod, request } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';

const SEGMENTS = [
  'Barbearia',
  'Salão de beleza',
  'Clínica',
  'Restaurante',
  'Imobiliária',
  'Loja',
  'Oficina',
  'Agência',
  'Prestador de serviços',
  'E-commerce',
  'Consultoria',
  'Outro',
];

interface BusinessSettings {
  name: string;
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  segment: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  opening_hours: string | null;
  timezone: string;
  logo_url: string | null;
  additional_info: string | null;
  limits: { whatsapp_daily_limit: number; email_daily_limit: number; interval_seconds: number; test_mode_max_leads: number };
}

const TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'America/Recife', 'America/Porto_Velho', 'America/Cuiaba', 'America/Campo_Grande', 'America/Noronha'];

export default function BusinessSettingsPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const business = useApi<BusinessSettings>(['business-settings'], 'business/settings');
  const settings = business.data;

  const [form, setForm] = useState<Record<string, string>>({});

  const saveMutation = useApiMutationMethod({
    onSuccess: () => {
      success('Dados da empresa salvos');
      queryClient.invalidateQueries({ queryKey: ['business-settings'] });
    },
    onError: (err) => toastError(err.message),
  });

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const fieldValue = (key: keyof BusinessSettings) => {
    if (form[key] !== undefined) return form[key];
    const v = settings?.[key];
    return v == null ? '' : String(v);
  };

  const save = async () => {
    await saveMutation.mutateAsync({
      _method: 'PATCH',
      _path: 'business/settings',
      name: form.name !== undefined ? form.name || settings?.name : undefined,
      segment: form.segment !== undefined ? form.segment : undefined,
      description: form.description !== undefined ? form.description : undefined,
      email: form.email !== undefined ? form.email : undefined,
      phone: form.phone !== undefined ? form.phone : undefined,
      address: form.address !== undefined ? form.address : undefined,
      website: form.website !== undefined ? form.website : undefined,
      instagram: form.instagram !== undefined ? form.instagram : undefined,
      opening_hours: form.opening_hours !== undefined ? form.opening_hours : undefined,
      timezone: form.timezone !== undefined ? form.timezone : undefined,
      logo_url: form.logo_url !== undefined ? form.logo_url : undefined,
      additional_info: form.additional_info !== undefined ? form.additional_info : undefined,
    });
    void request('business/settings');
  };

  const loading = business.isLoading;

  return (
    <DashboardShell title="Meu Negócio">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#008CFF]/10 border border-[#008CFF]/30 text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.2)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Perfil do Negócio</h1>
            <p className="text-xs text-slate-400">Dados cadastrais da sua organização — utilizados para calibrar a inteligência artificial</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                Identificação Institucional
              </h2>
            </div>
            <div className="space-y-4">
              <Input label="Nome da empresa" value={fieldValue('name')} onChange={(e) => setField('name', e.target.value)} placeholder="Ex.: Barbearia Central" disabled={loading} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Segmento</label>
                  <select
                    value={fieldValue('segment')}
                    onChange={(e) => setField('segment', e.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2.5 text-sm text-white outline-none focus:border-[#008CFF]"
                  >
                    <option value="" className="bg-[#080D18]">Selecione...</option>
                    {SEGMENTS.map((s) => (
                      <option key={s} value={s} className="bg-[#080D18]">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Input label="Telefone de Atendimento" value={fieldValue('phone')} onChange={(e) => setField('phone', e.target.value)} placeholder="(11) 99999-0000" disabled={loading} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="E-mail" type="email" value={fieldValue('email')} onChange={(e) => setField('email', e.target.value)} placeholder="contato@empresa.com" disabled={loading} />
                <Input label="CNPJ" value={fieldValue('cnpj')} onChange={(e) => setField('cnpj', e.target.value)} placeholder="00.000.000/0000-00" disabled={loading} />
              </div>
              <Input label="Descrição Resumida" value={fieldValue('description')} onChange={(e) => setField('description', e.target.value)} placeholder="Descreva sucintamente o que sua empresa oferece..." disabled={loading} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#7C3CFF] shadow-[0_0_8px_#7C3CFF]" />
                Presença Digital & Localização
              </h2>
            </div>
            <div className="space-y-4">
              <Input label="Endereço Completo" value={fieldValue('address')} onChange={(e) => setField('address', e.target.value)} placeholder="Rua, número, bairro, cidade..." disabled={loading} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Website" value={fieldValue('website')} onChange={(e) => setField('website', e.target.value)} placeholder="https://..." disabled={loading} />
                <Input label="Instagram" value={fieldValue('instagram')} onChange={(e) => setField('instagram', e.target.value)} placeholder="@suaempresa" disabled={loading} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Horário de Funcionamento" value={fieldValue('opening_hours')} onChange={(e) => setField('opening_hours', e.target.value)} placeholder="Seg a Sex 9h–18h, Sáb 9h–13h" disabled={loading} />
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Fuso Horário</label>
                  <select
                    value={fieldValue('timezone')}
                    onChange={(e) => setField('timezone', e.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-3 py-2.5 text-sm text-white outline-none focus:border-[#008CFF]"
                  >
                    {TIMEZONES.map((t) => (
                      <option key={t} value={t} className="bg-[#080D18]">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input label="Logotipo (URL)" value={fieldValue('logo_url')} onChange={(e) => setField('logo_url', e.target.value)} placeholder="https://.../logo.png" disabled={loading} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00E5A0] shadow-[0_0_8px_#00E5A0]" />
                Informações Complementares
              </h2>
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Instruções Adicionais</label>
              <textarea
                value={fieldValue('additional_info')}
                onChange={(e) => setField('additional_info', e.target.value)}
                disabled={loading}
                rows={4}
                placeholder="Informações complementares sobre sua empresa, diferenciais, observações..."
                className="w-full rounded-xl border border-white/10 bg-[#020409]/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#008CFF] focus:ring-1 focus:ring-[#008CFF]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={saveMutation.isPending} className="shadow-[0_0_15px_rgba(0,140,255,0.35)]">
              <Save className="mr-2 h-4 w-4" />
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}