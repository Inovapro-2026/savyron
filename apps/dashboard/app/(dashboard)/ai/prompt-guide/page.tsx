'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  FileText,
  Sparkles,
  Zap,
  ShieldCheck,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Building2,
  Stethoscope,
  ShoppingBag,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/shell';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useApi } from '@/hooks/use-api';

const TEMPLATE_PROMPT = `[IDENTIDADE E POSICIONAMENTO]
Você é o consultor oficial de atendimento e vendas de [NOME DA EMPRESA], especialista no segmento de [SEGMENTO].
Seu tom de voz deve ser: profissional, consultivo, acolhedor, objetivo e humano (nunca pareça um robô ou chatbot automático).
Seu objetivo principal é entender a necessidade do cliente e conduzi-lo para [OBJETIVO: ex. agendamento de consulta / orçamento / link de compra / contato com consultor humano].

[SOBRE A EMPRESA E DIFERENCIAIS]
- A empresa atua com: [DESCREVA PRODUTOS/SERVIÇOS PRINCIPAIS]
- Nossos principais diferenciais são: [DIFERENCIAIS: ex. atendimento personalizado, tecnologia de ponta, entrega rápida]
- Horário de atendimento: [HORÁRIOS]
- Localização/Área de atendimento: [CIDADE / ESTADO / OU ATENDIMENTO NACIONAL DIGITAL]

[REGRAS CRÍTICAS DE CONVERSAÇÃO NO WHATSAPP]
1. RESPOSTAS CURTAS: Envie mensagens breves (máximo 2 a 4 linhas). No WhatsApp ninguém gosta de textos gigantes.
2. UMA PERGUNTA POR VEZ: Nunca faça duas perguntas na mesma mensagem para não confundir o cliente.
3. ESCUTA ATIVA: Sempre responda primeiro à dúvida do cliente antes de fazer uma nova pergunta ou sugerir um produto.
4. NUNCA DESPEJE TUDO: Não envie todos os serviços ou catálogo de uma vez. Pergunte primeiro o que ele procura.
5. CONDUÇÃO COMERCIAL: Quando o cliente demonstrar interesse, direcione suavemente para o próximo passo (ex.: "Posso agendar um horário para você?", "Quer que eu envie o link direto da nossa vitrine?").
6. NUNCA INVENTE FATOS: Se não souber um preço, prazo ou informação específica, diga educadamente que vai confirmar com a equipe e avise que pode transferir para um atendente humano.
7. TRANSBORDO HUMANO: Se o cliente pedir para falar com uma pessoa real ou em situações complexas, avise que um especialista humano já está assumindo.`;

const CLINICA_EXAMPLE = `[IDENTIDADE E POSICIONAMENTO]
Você é a atendente virtual da Clínica Sorriso & Arte, referência em odontologia estética e implantes em São Paulo.
Tom de voz: muito atencioso, educado, claro e profissional.
Objetivo: tirar dúvidas iniciais dos pacientes e agendar uma avaliação na clínica.

[SOBRE A CLÍNICA]
- Especialidades: Implantes dentários, Alinhadores invisíveis, Clareamento a laser, Lentes de resina e Próteses.
- Diferenciais: Tecnologia 3D sem dor, parcelamento facilitado em até 24x e estacionamento gratuito no local.
- Endereço: Av. Paulista, 1000 - Bela Vista, São Paulo/SP.
- Horário: Segunda a Sexta das 08h às 19h e Sábados das 08h às 13h.

[REGRAS DE CONDUTA]
- Nunca passe valores exatos de tratamentos complexos (como implantes) sem avaliação prévia do dentista. Explique com simpatia que cada caso é único e convide para a consulta de avaliação.
- Mantenha mensagens curtas (2 a 3 frases).
- Faça sempre apenas uma pergunta por vez.
- Ofereça opções de dias e períodos (manhã ou tarde) para facilitar o agendamento do paciente.`;

const SAAS_EXAMPLE = `[IDENTIDADE E POSICIONAMENTO]
Você é o assistente comercial oficial da SAVYRON, a plataforma de inteligência comercial com IA que revoluciona a prospecção e vendas para empresas.
Tom de voz: consultivo, inovador, dinâmico e focado no crescimento do cliente.
Objetivo: qualificar o perfil do cliente e convidá-lo a testar a plataforma ou assinar um plano.

[SOBRE A PLATAFORMA]
- O que faz: Prospecção inteligente de leads B2B, automação multicanal (WhatsApp e E-mail), CRM integrado e atendentes de IA que respondem 24/7.
- Para quem serve: Clínicas, escritórios, agências, comércios, corretores e prestadores de serviços.
- Planos e Teste: Planos acessíveis mensais sem fidelidade, com teste prático imediato.

[REGRAS DE CONDUTA]
- Entenda primeiro o segmento e a maior dor do cliente (ex.: "Você precisa de mais clientes chegando ou de automação para responder rápido?").
- Apresente apenas a solução que resolve a dor dele.
- Quando demonstrar interesse, envie o link de cadastro ou ofereça uma demonstração guiada.`;

const BEST_PRACTICES = [
  {
    title: 'Mensagens Curtas & Diretas',
    desc: 'No WhatsApp, mensagens com mais de 4 linhas parecem panfletos e são ignoradas. Oriente a IA a falar como um atendente real digitando no celular.',
  },
  {
    title: 'Uma Única Pergunta por Vez',
    desc: 'Fazer várias perguntas trava o cliente. Deixe a conversa fluir em turnos rápidos de pergunta e resposta.',
  },
  {
    title: 'Validação de Fatos & Segurança',
    desc: 'Instrua a IA a nunca prometer o que sua empresa não cumpre ou inventar dados técnicos não fornecidos na configuração.',
  },
  {
    title: 'Até 15.000 Caracteres de Contexto',
    desc: 'Aproveite o novo limite expandido para colocar regras completas, tabela de serviços, políticas de garantia, FAQ de dúvidas e horários.',
  },
];

export default function PromptGuidePage() {
  const { success } = useToast();
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedClinica, setCopiedClinica] = useState(false);
  const [copiedSaas, setCopiedSaas] = useState(false);
  const [useBusinessData, setUseBusinessData] = useState(true);

  const business = useApi<{
    name: string | null;
    segment: string | null;
  }>(['business-settings'], 'business/settings');

  const formattedTemplate = useMemo(() => {
    if (!useBusinessData) return TEMPLATE_PROMPT;
    const name = business.data?.name?.trim();
    const segment = business.data?.segment?.trim();
    if (!name && !segment) return TEMPLATE_PROMPT;
    return TEMPLATE_PROMPT
      .replace('[NOME DA EMPRESA]', name || '[NOME DA EMPRESA]')
      .replace('[SEGMENTO]', segment || '[SEGMENTO]');
  }, [business.data, useBusinessData]);

  const copyText = async (text: string, setFn: (v: boolean) => void, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFn(true);
      success(msg);
      setTimeout(() => setFn(false), 2000);
    } catch {
      success('Texto selecionado. Copie usando Ctrl+C.');
    }
  };

  return (
    <DashboardShell title="Guia de Prompts do SAVYRON">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/settings/empresa-ia"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E5FF] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Configuração da IA
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Guia Mestre de Prompts & Engenharia Neural
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Como estruturar as diretrizes e regras da sua IA para gerar atendimentos consultivos, naturais e de alta conversão
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Banner de Destaque com o limite de 15.000 caracteres */}
        <div className="relative overflow-hidden rounded-2xl border border-[#008CFF]/30 bg-gradient-to-br from-[#008CFF]/15 via-[#080D18]/90 to-[#080D18] p-6 shadow-[0_0_25px_rgba(0,140,255,0.1)] backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#008CFF] to-[#00E5FF] text-black font-extrabold shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Janela de Contexto Expandida: Até 15.000 Caracteres
                </h3>
                <span className="rounded-full bg-[#00E5A0]/10 px-2.5 py-0.5 text-[10px] font-extrabold text-[#00E5A0] border border-[#00E5A0]/30 shadow-[0_0_8px_rgba(0,229,160,0.2)]">
                  Capacidade Máxima
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                O campo <strong>"Descrição da empresa / diretrizes da IA"</strong> suporta até 15.000 caracteres. Você pode injetar identidade completa da empresa, procedimentos de qualificação, FAQ extenso, catálogos detalhados e matriz de objeções em uma única base neural.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Pilares de Boas Práticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BEST_PRACTICES.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/5 bg-[#080D18]/80 p-5 backdrop-blur-md transition-all hover:border-cyan-500/30 hover:bg-[#0C1427]/90 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#008CFF]/15 border border-[#008CFF]/30 text-[#00E5FF] font-bold text-xs mb-3 shadow-[0_0_8px_rgba(0,229,255,0.2)]">
                0{idx + 1}
              </div>
              <h4 className="text-xs font-bold text-white mb-1.5">{item.title}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Prompt Modelo Principal */}
        <div className="rounded-2xl border border-white/10 bg-[#080D18]/90 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] shadow-[0_0_10px_rgba(0,229,160,0.15)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Prompt-Modelo Mestre (Copie e Cole)</h3>
                <p className="text-xs text-slate-400">
                  Estrutura universal otimizada para atendimento de alta conversão no WhatsApp.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={useBusinessData}
                  onChange={(e) => setUseBusinessData(e.target.checked)}
                  className="accent-[#008CFF] rounded"
                />
                Inserir dados do meu negócio
              </label>
              <button
                type="button"
                onClick={() => void copyText(formattedTemplate, setCopiedTemplate, 'Prompt-modelo copiado!')}
                className="btn-primary text-xs px-4 py-2 shadow-[0_0_15px_rgba(0,140,255,0.35)] flex items-center gap-1.5"
              >
                {copiedTemplate ? <Check className="h-4 w-4 text-black" /> : <Copy className="h-4 w-4" />}
                {copiedTemplate ? 'Copiado!' : 'Copiar Prompt'}
              </button>
            </div>
          </div>

          <div className="p-5">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#020409]/90 p-4 font-mono text-xs leading-relaxed text-slate-200">
              {formattedTemplate}
            </pre>
          </div>
        </div>

        {/* Exemplos Prontos por Segmento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Exemplo 1: Clínica / Saúde / Estética */}
          <div className="rounded-2xl border border-white/10 bg-[#080D18]/90 backdrop-blur-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/20">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Exemplo: Clínica Odontológica / Estética</h4>
                  <p className="text-[10px] text-slate-400">Foco em agendamento de consultas e avaliações</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyText(CLINICA_EXAMPLE, setCopiedClinica, 'Exemplo de clínica copiado!')}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
              >
                {copiedClinica ? <Check className="h-3.5 w-3.5 text-[#00E5A0]" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedClinica ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#020409]/90 p-3.5 font-mono text-[11px] leading-relaxed text-slate-300 max-h-72 overflow-y-auto">
                {CLINICA_EXAMPLE}
              </pre>
            </div>
          </div>

          {/* Exemplo 2: Tecnologia / B2B / SaaS */}
          <div className="rounded-2xl border border-white/10 bg-[#080D18]/90 backdrop-blur-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 p-4 bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#008CFF]/10 text-[#00E5FF] border border-[#008CFF]/20">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Exemplo: Empresa B2B / Serviços / SaaS</h4>
                  <p className="text-[10px] text-slate-400">Foco em qualificação e demonstração comercial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyText(SAAS_EXAMPLE, setCopiedSaas, 'Exemplo B2B copiado!')}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
              >
                {copiedSaas ? <Check className="h-3.5 w-3.5 text-[#00E5A0]" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSaas ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-[#020409]/90 p-3.5 font-mono text-[11px] leading-relaxed text-slate-300 max-h-72 overflow-y-auto">
                {SAAS_EXAMPLE}
              </pre>
            </div>
          </div>
        </div>

        {/* Como Aplicar Passo a Passo */}
        <div className="rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-xl shadow-xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
            Como aplicar no SAVYRON em 3 passos:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#008CFF]/20 border border-[#008CFF]/40 text-[#00E5FF] text-xs font-bold mb-2 shadow-[0_0_8px_rgba(0,140,255,0.2)]">
                1
              </span>
              <h4 className="text-xs font-bold text-white mb-1">Copie o Prompt</h4>
              <p className="text-[11px] text-slate-400">
                Clique no botão <strong>"Copiar Prompt"</strong> acima ou selecione um dos modelos segmentados.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#008CFF]/20 border border-[#008CFF]/40 text-[#00E5FF] text-xs font-bold mb-2 shadow-[0_0_8px_rgba(0,140,255,0.2)]">
                2
              </span>
              <h4 className="text-xs font-bold text-white mb-1">Cole na Configuração</h4>
              <p className="text-[11px] text-slate-400">
                Acesse <Link href="/settings/empresa-ia" className="text-[#00E5FF] font-semibold underline">Configuração da IA</Link> e cole no campo de diretrizes.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00E5A0]/20 border border-[#00E5A0]/40 text-[#00E5A0] text-xs font-bold mb-2 shadow-[0_0_8px_rgba(0,229,160,0.2)]">
                3
              </span>
              <h4 className="text-xs font-bold text-white mb-1">Clique em "Aplicar na IA"</h4>
              <p className="text-[11px] text-slate-400">
                O motor neural compilará as instruções e passará a responder instantaneamente com essas regras no WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
