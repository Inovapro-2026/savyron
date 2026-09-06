import type { Metadata } from "next";
import Link from "next/link";
import {
  Radar,
  Bot,
  HandCoins,
  HeartHandshake,
  MessageSquareText,
  Inbox,
  BarChart3,
  CreditCard,
  Store,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { VitrinePlans } from "@/components/vitrine/vitrine-plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.inovapro.cloud";

export const metadata: Metadata = {
  title: "Seu negócio está perdendo clientes todos os dias — SAVYRON",
  description:
    "Enquanto você trabalha, o SAVYRON prospecta novos clientes, inicia conversas e engaja automaticamente. Prospecte. Engaje. Venda. Atenda.",
  openGraph: {
    title: "SAVYRON — Prospecte. Engaje. Venda. Atenda.",
    description:
      "Enquanto você trabalha, o SAVYRON prospecta novos clientes, inicia conversas e engaja automaticamente.",
    url: `${APP_URL}/vitrine`,
    siteName: "SAVYRON",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: `${APP_URL}/logo-og.png`,
        width: 1200,
        height: 630,
        alt: "SAVYRON",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAVYRON — Prospecte. Engaje. Venda. Atenda.",
    description:
      "Enquanto você trabalha, o SAVYRON prospecta novos clientes, inicia conversas e engaja automaticamente.",
    images: [`${APP_URL}/logo-og.png`],
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  {
    icon: Radar,
    title: "Prospecte",
    text: "Enquanto você trabalha, o SAVYRON encontra e organiza novos clientes para o seu negócio.",
  },
  {
    icon: Bot,
    title: "Engaje",
    text: "A inteligência artificial inicia conversas, entende cada cliente e responde dúvidas.",
  },
  {
    icon: HandCoins,
    title: "Venda",
    text: "Apresenta soluções e ajuda a transformar conversas em vendas.",
  },
  {
    icon: HeartHandshake,
    title: "Atenda",
    text: "Depois da venda, o SAVYRON continua atendendo e oferecendo suporte.",
  },
];

const SEGMENTS = [
  "Barbearia",
  "Salão",
  "Clínica",
  "Restaurante",
  "Imobiliária",
  "Loja",
  "E qualquer outro negócio",
];

const FEATURES = [
  {
    icon: Radar,
    title: "Prospecção automática de leads",
    text: "Importe contatos e deixe as campanhas fazerem o primeiro contato automaticamente, no seu ritmo.",
  },
  {
    icon: Bot,
    title: "IA configurável por empresa",
    text: "Treine a IA com a base de conhecimento do seu negócio para que ela responda como a sua equipe.",
  },
  {
    icon: MessageSquareText,
    title: "WhatsApp integrado",
    text: "Converse com os clientes direto no WhatsApp, de onde eles já estão.",
  },
  {
    icon: Inbox,
    title: "Mensagens unificadas",
    text: "Todas as conversas em um só lugar, em tempo real, sem perder nenhuma mensagem.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    text: "Acompanhe o desempenho das campanhas e o engajamento de cada contato.",
  },
  {
    icon: CreditCard,
    title: "Planos com PIX ou cartão",
    text: "Contrate o plano que cabe no seu negócio e pague como preferir, com segurança.",
  },
];

function CtaButton({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-7 py-3.5 text-sm font-bold transition-all duration-200";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black shadow-[0_0_25px_rgba(0,140,255,0.35)] hover:brightness-110 hover:shadow-[0_0_35px_rgba(0,140,255,0.5)]"
      : "border border-white/15 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10 hover:text-white";
  return (
    <Link href={href} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

function SectionTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#008CFF]/30 bg-[#008CFF]/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[#00E5FF] shadow-[0_0_12px_rgba(0,140,255,0.15)]">
        {kicker}
      </div>
      <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base text-slate-400 sm:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function VitrinePage() {
  return (
    <div className="min-h-screen bg-[#020409] text-slate-100 selection:bg-[#008CFF]/30 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080D18]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/vitrine" aria-label="SAVYRON">
            <Logo height={40} />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-400 sm:flex">
            <a
              href="#como-funciona"
              className="transition-colors hover:text-[#00E5FF]"
            >
              Como Funciona
            </a>
            <a
              href="#para-quem"
              className="transition-colors hover:text-[#00E5FF]"
            >
              Para Quem É
            </a>
            <a
              href="#recursos"
              className="transition-colors hover:text-[#00E5FF]"
            >
              Recursos
            </a>
            <a href="#planos" className="transition-colors hover:text-[#00E5FF]">
              Planos
            </a>
          </nav>
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-[#008CFF]/40 hover:bg-[#008CFF]/10 hover:text-white"
          >
            Entrar no Painel
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Glows de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-b from-[#008CFF]/15 via-[#7C3CFF]/10 to-transparent blur-[140px]"
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#008CFF]/30 bg-[#008CFF]/10 px-4 py-1.5 text-xs font-semibold text-[#00E5FF] shadow-[0_0_20px_rgba(0,140,255,0.2)]">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#00E5FF]" />
            Motor Comercial Autônomo &bull; IA de Alta Precisão
          </div>
          <h1 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl">
            Seu negócio está perdendo{" "}
            <span className="bg-gradient-to-r from-[#008CFF] via-[#00E5FF] to-[#00E5A0] bg-clip-text text-transparent">
              clientes todos os dias.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
            Enquanto você trabalha, o SAVYRON prospecta novos leads, inicia
            conversas qualificadas e engaja no WhatsApp — usando inteligência artificial
            para entender cada cliente, contornar objeções e acelerar conversões em tempo real.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <CtaButton href="/signup" className="w-full sm:w-auto">
              Criar Conta Gratuita
            </CtaButton>
            <CtaButton
              href="#planos"
              variant="outline"
              className="w-full sm:w-auto"
            >
              Ver Planos & Recursos
            </CtaButton>
          </div>
          <p className="mt-6 text-xs text-slate-500 font-medium">
            Sem necessidade de cartão para testar &bull; Configuração guiada em minutos &bull; Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section
        id="como-funciona"
        className="border-t border-white/10 bg-[#080D18]/50 py-24 relative"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            kicker="Pipeline Autônomo"
            title="Um sistema completo, do primeiro contato ao suporte"
            subtitle="Da busca ativa ao atendimento pós-venda contínuo, sem intervenção humana manual necessária."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div
                key={title}
                className="group relative rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#008CFF]/40 hover:shadow-[0_0_25px_rgba(0,140,255,0.15)]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#008CFF]/30 bg-[#008CFF]/15 text-[#00E5FF] transition-colors group-hover:bg-[#008CFF]/25">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-[#00E5FF]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {title}
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quem é */}
      <section id="para-quem" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionTitle
          kicker="Segmentos Atendidos"
          title="Feito para negócios de todos os portes"
          subtitle="O SAVYRON é horizontal: potencializa qualquer empresa que dependa de comunicação ágil e fechamento comercial."
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          {SEGMENTS.map((segment) => (
            <span
              key={segment}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-[#080D18]/80 px-5 py-2.5 text-xs font-semibold text-slate-300 backdrop-blur-md transition-all hover:border-[#008CFF]/40 hover:text-white shadow-sm"
            >
              {segment !== "E qualquer outro negócio" ? (
                <Store className="h-4 w-4 text-[#00E5A0]" />
              ) : null}
              {segment}
            </span>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="border-t border-white/10 bg-[#080D18]/50 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle
            kicker="Poder Computacional"
            title="Tudo o que você precisa para escalar vendas"
            subtitle="Infraestrutura completa de inteligência artificial comercial integrada ao ecossistema WhatsApp."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/10 bg-[#080D18]/80 p-6 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#020409]/60 text-[#00E5FF] transition-colors group-hover:border-[#008CFF]/30 group-hover:bg-[#008CFF]/10">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionTitle
          kicker="Tabela de Planos"
          title="Escolha o plano ideal para a sua operação"
          subtitle="Preços em tempo real com ativação instantânea via PIX ou Cartão de Crédito."
        />
        <VitrinePlans />
        <div className="mt-12 text-center">
          <CtaButton href="/signup" className="w-full sm:w-auto">
            Criar Conta e Iniciar Teste
          </CtaButton>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden border-t border-white/10 bg-[#080D18] py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#008CFF]/15 via-transparent to-[#7C3CFF]/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-8 w-fit">
            <Logo height={64} priority={false} />
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-5xl">
            SAVYRON.
            <br />
            <span className="bg-gradient-to-r from-[#008CFF] via-[#00E5FF] to-[#00E5A0] bg-clip-text text-transparent">
              Prospecte. Engaje. Venda. Atenda.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
            Recupere clientes perdidos e coloque sua operação comercial no piloto automático agora mesmo.
          </p>
          <div className="mt-10">
            <CtaButton href="/signup" className="w-full sm:w-auto">
              Criar Minha Conta Agora
            </CtaButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#020409]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
          <Link href="/vitrine" aria-label="SAVYRON">
            <Logo height={44} priority={false} />
          </Link>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link
              href="/login"
              className="transition-colors hover:text-[#00E5FF]"
            >
              Entrar
            </Link>
            <a href="#planos" className="transition-colors hover:text-[#00E5FF]">
              Planos
            </a>
          </div>
          <div className="text-xs font-mono text-slate-500">
            &copy; {new Date().getFullYear()} SAVYRON &bull; Neural Commercial Engine
          </div>
        </div>
      </footer>
    </div>
  );
}
