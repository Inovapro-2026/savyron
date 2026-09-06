"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Upload, MessageCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/shell";
import { ProspectTab } from "@/components/prospect/prospect-tab";
import { ImportTab } from "@/components/prospect/import-tab";
import { WhatsAppTab } from "@/components/prospect/whatsapp-tab";

function ProspectHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab");

  const active =
    tab === "import" ? "import" : tab === "whatsapp" ? "whatsapp" : "prospect";

  const setTab = (next: "prospect" | "import" | "whatsapp") => {
    router.replace(
      next === "import"
        ? "/prospect?tab=import"
        : next === "whatsapp"
          ? "/prospect?tab=whatsapp"
          : "/prospect",
    );
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2.5">
        <button
          onClick={() => setTab("prospect")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
            active === "prospect"
              ? "border border-[#00E5FF]/50 bg-gradient-to-r from-[#008CFF]/25 to-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)] ring-1 ring-[#00E5FF]/30"
              : "border border-white/10 bg-[#080D18]/80 text-[#A8B3C7] hover:border-[#008CFF]/40 hover:bg-[#0C1427] hover:text-white"
          }`}
        >
          <Search className="h-4 w-4 text-[#00E5FF]" /> Prospecção Web
        </button>
        <button
          onClick={() => setTab("import")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
            active === "import"
              ? "border border-[#00E5FF]/50 bg-gradient-to-r from-[#008CFF]/25 to-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)] ring-1 ring-[#00E5FF]/30"
              : "border border-white/10 bg-[#080D18]/80 text-[#A8B3C7] hover:border-[#008CFF]/40 hover:bg-[#0C1427] hover:text-white"
          }`}
        >
          <Upload className="h-4 w-4 text-[#008CFF]" /> Importação Manual
        </button>
        <button
          onClick={() => setTab("whatsapp")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
            active === "whatsapp"
              ? "border border-[#00E5A0]/50 bg-gradient-to-r from-[#008CFF]/20 to-[#00E5A0]/20 text-[#00E5A0] shadow-[0_0_20px_rgba(0,229,160,0.25)] ring-1 ring-[#00E5A0]/30"
              : "border border-white/10 bg-[#080D18]/80 text-[#A8B3C7] hover:border-[#00E5A0]/40 hover:bg-[#0C1427] hover:text-white"
          }`}
        >
          <MessageCircle className="h-4 w-4 text-[#00E5A0]" /> WhatsApp Baileys
        </button>
      </div>

      {active === "prospect" ? (
        <ProspectTab />
      ) : active === "whatsapp" ? (
        <WhatsAppTab />
      ) : (
        <ImportTab />
      )}
    </>
  );
}


export default function ProspectPage() {
  return (
    <DashboardShell title="Prospecção">
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-400">
            Carregando…
          </div>
        }
      >
        <ProspectHub />
      </Suspense>
    </DashboardShell>
  );
}
