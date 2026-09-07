import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Users,
  ScrollText,
  Activity,
  Settings,
  ArrowLeft,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Empresas", icon: Building2 },
  { href: "/admin/plans", label: "Planos", icon: CreditCard },
  { href: "/admin/subscriptions", label: "Assinaturas", icon: Receipt },
  { href: "/admin/payments", label: "Pagamentos", icon: Receipt },
  { href: "/admin/users", label: "Usuários", icon: Users },
  { href: "/admin/usage", label: "Uso", icon: Activity },
  { href: "/admin/audit", label: "Auditoria", icon: ScrollText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
];

export const metadata = { title: "Admin — SAVYRON" };

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (
    session.platform_role !== "PLATFORM_ADMIN" &&
    session.platform_role !== "PLATFORM_STAFF"
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="dashboard-wrapper min-h-screen bg-[#020409] text-slate-100 lg:flex">
      {session.impersonating ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-500/40 bg-amber-950/80 px-4 py-2 text-center text-xs font-semibold text-amber-300 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          Você está acessando esta empresa como administrador da plataforma
          {session.impersonator ? ` (${session.impersonator})` : ""}.
          <Link href="/admin/impersonate/exit" className="ml-2 underline font-bold text-amber-200 hover:text-white">
            Sair do modo de suporte
          </Link>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#080D18]/90 backdrop-blur-xl lg:flex shadow-2xl">
        <div className="border-b border-white/10 px-6 py-5">
          <Logo compact />
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#008CFF]/20 bg-[#008CFF]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00E5FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
            Admin Plataforma
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 px-3.5 py-5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:border hover:border-white/10 hover:bg-[#020409]/80 hover:text-white"
            >
              <Icon className="h-4 w-4 text-slate-500 transition-colors group-hover:text-[#00E5FF]" />
              {label}
            </Link>
          ))}
          <div className="pt-4 border-t border-white/10 mt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/10 px-3.5 py-2.5 text-sm font-semibold text-[#00E5FF] transition-all hover:bg-[#008CFF]/20 shadow-[0_0_15px_rgba(0,140,255,0.15)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Painel
            </Link>
          </div>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 pt-10 lg:pt-0">
        <div className="border-b border-white/10 bg-[#080D18]/90 backdrop-blur-md px-4 py-3 lg:hidden">
          <Logo compact />
        </div>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

