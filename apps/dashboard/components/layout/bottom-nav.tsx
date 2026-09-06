"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  MessageSquare,
  Mic,
  Megaphone,
  Users,
  Mail,
  BarChart3,
  Bot,
  Crown,
  BookOpen,
  FlaskConical,
  Sparkles,
  ShieldCheck,
  Settings,
  X,
  ChevronRight,
  HelpCircle,
  ChevronDown,
  Plug,
} from "lucide-react";
import { NAV_ITEMS, EMPRESA_NAV, ADVANCED_NAV, ADMIN_NAV, SETTINGS_NAV } from "@/lib/navigation";
import { useSession } from "@/hooks/use-session";

const BOTTOM_ITEMS = NAV_ITEMS.filter((i) => i.mobileBottom);

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const canSeeAdmin =
    user?.platform_role === "PLATFORM_ADMIN" || user?.platform_role === "PLATFORM_STAFF";

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgba(0,140,255,0.18)] bg-[#020409]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden shadow-[0_-4px_25px_rgba(0,0,0,0.8)]"
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-around">
          {BOTTOM_ITEMS.map(({ href, label, icon: Icon, center }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              aria-label={center ? "Abrir Agente de Voz" : label}
              className={`relative flex min-w-0 flex-1 flex-col items-center py-2 transition-colors ${
                center ? "justify-end pb-2" : "justify-center gap-1"
              } ${isActive(href) && !center ? "text-[#00E5FF] font-bold drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]" : "text-[#A8B3C7] hover:text-white"}`}
            >
              {center ? (
                <span
                  className={`flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full shadow-lg ring-4 transition-all ${
                    isActive(href)
                      ? "bg-gradient-to-tr from-[#008CFF] to-[#00E5FF] text-[#020409] ring-[#00E5FF]/40 shadow-[0_0_25px_rgba(0,229,255,0.7)]"
                      : "bg-gradient-to-tr from-[#0077FF] to-[#00C6FF] text-white ring-[rgba(0,153,255,0.3)] shadow-[0_0_20px_rgba(0,140,255,0.5)]"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                </span>
              ) : (
                <Icon
                  className={`h-5 w-5 transition-colors ${isActive(href) ? "text-[#00E5FF]" : "text-[#64748B]"}`}
                />
              )}

              {!center ? (
                <span className={`text-[10px] ${isActive(href) ? "text-[#00E5FF] font-bold" : "text-[#A8B3C7]"}`}>
                  {label}
                </span>
              ) : (
                <span className={`-mt-3 text-[10px] ${isActive(href) ? "text-[#00E5FF] font-bold" : "text-[#A8B3C7]"}`}>
                  {label}
                </span>
              )}
            </Link>
          ))}

          {/* Botão "Mais" */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Abrir mais opções"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[#A8B3C7] transition-colors hover:text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center">
              <span className="flex h-1.5 w-1.5 gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-4 rounded-full bg-current" />
              </span>
            </span>
            <span className="text-[10px]">Mais</span>
          </button>
        </div>
      </nav>

      {/* "Mais" drawer overlay */}
      {moreOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#050914] border-t border-[rgba(0,153,255,0.25)] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.9)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(0,153,255,0.15)] bg-[#080D18] px-5 py-4">
              <h2 className="text-base font-bold text-white">Navegar</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-xl p-1.5 text-[#A8B3C7] hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pb-6 pt-3">
              {/* Geral */}
              <DrawerSection
                title="Geral"
                items={NAV_ITEMS.filter((i) => i.group === "main" && !i.mobileBottom)}
                pathname={pathname}
                onNavigate={() => setMoreOpen(false)}
              />

              {/* Empresa */}
              <DrawerSection
                title="Empresa"
                items={EMPRESA_NAV}
                pathname={pathname}
                onNavigate={() => setMoreOpen(false)}
              />

              {/* Avançado */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  aria-expanded={advancedOpen}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#64748B] transition-colors hover:text-[#A8B3C7]"
                >
                  Avançado
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {advancedOpen ? (
                  <div className="mt-1 pl-1">
                    {ADVANCED_NAV.map((item) => (
                      <DrawerItem key={item.href} {...item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Admin (se tiver permissão) */}
              {canSeeAdmin ? (
                <div className="mb-4">
                  <DrawerItem {...ADMIN_NAV} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
                </div>
              ) : null}

              {/* Configurações */}
              <div className="pt-2 border-t border-[rgba(0,153,255,0.15)]">
                <DrawerItem {...SETTINGS_NAV} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DrawerSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: { href: string; label: string; icon: typeof LayoutDashboard }[];
  pathname: string;
  onNavigate: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
        {title}
      </div>
      {items.map((item) => (
        <DrawerItem key={item.href} {...item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function DrawerItem({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-[#008CFF]/15 text-[#00E5FF] font-bold border-l-2 border-[#00E5FF]"
          : "text-[#A8B3C7] hover:bg-[#008CFF]/8 hover:text-white"
      }`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? "text-[#00E5FF]" : "text-[#64748B]"}`} />
      <span className="truncate">{label}</span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[#64748B]" />
    </Link>
  );
}