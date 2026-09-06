"use client";

import { useMemo, useRef, useState } from "react";
import {
  Upload,
  ClipboardPaste,
  FileSpreadsheet,
  Download,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button, Spinner } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useApi, request } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, isBusinessOwnerOrAdmin } from "@/hooks/use-session";

interface PreviewRow {
  rowIndex: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  businessName: string | null;
  city: string | null;
  state: string | null;
  status: "VALID" | "DUPLICATE" | "INVALID" | "NEW";
  errors: string[];
  duplicateReasons: string[];
}

interface PreviewResponse {
  importId: string;
  filename: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  newLeads: number;
  rows: PreviewRow[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
}

const SAMPLE_CSV = `nome;telefone;email;empresa;cidade;estado
Barbearia do João;11 98765-4321;contato@barbeariadojoao.com;Barbearia do João;São Paulo;SP
Salão da Maria;21 99876-5432;maria@salaodamaria.com;Salão da Maria;Rio de Janeiro;RJ
Studio Corte;CELULAR_INVALIDO;;Studio Corte;Belo Horizonte;MG
Barbearia Central;11 98765-4321;;Barbearia Central;Campinas;SP`;

export function ImportTab() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearLeadsOpen, setClearLeadsOpen] = useState(false);
  const [clearingLeads, setClearingLeads] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const campaigns = useApi<Campaign[]>(["campaigns"], "campaigns");
  const importedCounts = useApi<{ total_imported: number; in_queue: number }>(
    ["leads-imported-count"],
    "leads/imported/count",
  );

  const canAdmin = isBusinessOwnerOrAdmin(user?.businessRole);

  const doPreview = async () => {
    setLoading(true);
    try {
      let res: Response;
      if (mode === "file" && file) {
        const form = new FormData();
        form.append("file", file);
        form.append("test_mode", String(isTest));
        res = await fetch("/api/proxy/leads/import/preview", {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch("/api/proxy/leads/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, test_mode: isTest }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        toastError(data?.error?.message ?? "Falha ao processar arquivo");
        return;
      }
      setPreview(data.data as PreviewResponse);
      success(`Prévia calculada: ${data.data.newLeads} leads novos`);
    } catch {
      toastError("Falha ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      await request("leads/import/confirm", {
        method: "POST",
        body: {
          importId: preview.importId,
          campaignId: campaignId || undefined,
          isTest,
        },
      });
      success("Importação enfileirada com sucesso");
      setPreview(null);
      setFile(null);
      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setConfirming(false);
    }
  };

  const clearImportedLeads = async () => {
    setClearingLeads(true);
    try {
      const res = await request<{ deleted: number }>("leads/imported", {
        method: "DELETE",
        body: {},
      });
      success(
        `${res.deleted} lead${res.deleted === 1 ? "" : "s"} importado${res.deleted === 1 ? "" : "s"} excluído${res.deleted === 1 ? "" : "s"}`,
      );
      setClearLeadsOpen(false);
      setPreview(null);
      importedCounts.refetch();
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Falha ao limpar leads importados",
      );
    } finally {
      setClearingLeads(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(
    () => [
      { label: "Total", value: preview?.total ?? 0, tone: "zinc" as const },
      {
        label: "Válidos/novos",
        value: preview?.newLeads ?? 0,
        tone: "emerald" as const,
      },
      {
        label: "Duplicados",
        value: preview?.duplicates ?? 0,
        tone: "amber" as const,
      },
      {
        label: "Inválidos",
        value: preview?.invalid ?? 0,
        tone: "red" as const,
      },
    ],
    [preview],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Importação manual"
          subtitle="Subir arquivo .csv / .xlsx ou colar texto. Você pode colar só números ou só e-mails, um por linha — sem precisar de nomes nem colunas."
          action={
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="h-4 w-4" /> Modelo
            </Button>
          }
        />

        <div className="mb-4 flex gap-2">
          <Button
            variant={mode === "file" ? "primary" : "outline"}
            size="sm"
            onClick={() => setMode("file")}
          >
            <Upload className="h-4 w-4" /> Arquivo
          </Button>
          <Button
            variant={mode === "paste" ? "primary" : "outline"}
            size="sm"
            onClick={() => setMode("paste")}
          >
            <ClipboardPaste className="h-4 w-4" /> Colar texto
          </Button>
        </div>

        {mode === "file" ? (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#008CFF]/30 bg-[#0C1427]/60 p-10 text-center transition-all duration-200 hover:border-[#00E5FF]/60 hover:bg-[#0E1A33] hover:shadow-[0_0_25px_rgba(0,229,255,0.15)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="text-sm font-semibold text-white">
              {file ? file.name : "Clique para escolher um arquivo ou arraste até aqui"}
            </div>
            <div className="mt-1.5 text-xs text-[#A8B3C7]">
              Planilhas CSV ou Excel (.xlsx, .xls) • Máximo 5MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <Textarea
            placeholder={
              "Apenas números (um por linha):\n11987654321\n21987654321\n\nou apenas e-mails (um por linha):\ncontato@barbearia.com\nmaria@salao.com\n\nou CSV completo:\nnome;telefone;email\nBarbearia do João;11 98765-4321;contato@barbearia.com"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0C1427]/60 p-3.5 cursor-pointer hover:border-[#00E5FF]/40 transition-colors">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="h-4 w-4 accent-[#00E5FF] rounded"
            />
            <div>
              <div className="text-xs font-bold text-white">
                Modo Teste
              </div>
              <div className="text-[11px] text-[#A8B3C7]">
                Importa apenas os primeiros 5 leads
              </div>
            </div>
          </label>
          <div className="sm:col-span-2">
            <label className="label">Importar para Campanha (opcional)</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="input"
            >
              <option value="">Sem campanha vinculada (apenas banco de leads)</option>
              {campaigns.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => void doPreview()}
            loading={loading}
            disabled={mode === "file" ? !file : !text.trim()}
          >
            Calcular Prévia
          </Button>
        </div>
      </Card>

      {preview ? (
        <Card>
          <CardHeader
            title={`Prévia — ${preview.filename}`}
            subtitle={`${preview.total} linhas processadas no arquivo`}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-[#0C1427]/70 p-3.5 text-center shadow-sm"
              >
                <div
                  className={`font-display text-2xl font-black ${
                    c.tone === "emerald"
                      ? "text-[#00E5A0]"
                      : c.tone === "amber"
                        ? "text-[#FFB020]"
                        : c.tone === "red"
                          ? "text-[#FF3366]"
                          : "text-white"
                  }`}
                >
                  {c.value}
                </div>
                <div className="text-[11px] font-semibold text-[#A8B3C7] mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#080D18]/80">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-[#0D152A] text-[10px] uppercase tracking-wider text-[#A8B3C7]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Telefone</th>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {preview.rows.slice(0, 50).map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-[#0E1A33]/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {row.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#A8B3C7]">
                      {row.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#A8B3C7]">
                      {row.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#A8B3C7]">
                      {row.businessName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          row.status === "NEW"
                            ? "emerald"
                            : row.status === "DUPLICATE"
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.status === "NEW"
                          ? "Novo"
                          : row.status === "DUPLICATE"
                            ? "Duplicado"
                            : "Inválido"}
                      </Badge>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-[11px] text-[#64748B]">
                      {row.errors.join(", ") || row.duplicateReasons.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col-reverse justify-end gap-2.5 sm:flex-row">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmImport()}
              loading={confirming}
              disabled={preview.newLeads === 0}
            >
              Confirmar Importação ({preview.newLeads} leads)
            </Button>
          </div>
        </Card>
      ) : null}

      {canAdmin ? (
        <Card className="border-red-500/30 shadow-[0_0_20px_rgba(255,51,102,0.15)]">
          <CardHeader
            title="Limpar leads importados"
            subtitle="Ação destrutiva de alto risco — restrita ao proprietário/admin"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-xs text-[#A8B3C7]">
                <strong className="text-white">
                  {importedCounts.data?.total_imported ?? 0}
                </strong>{" "}
                leads importados ·{" "}
                <strong className="text-amber-400">
                  {importedCounts.data?.in_queue ?? 0}
                </strong>{" "}
                na fila (aguardando envio)
              </div>
            </div>
            <Button
              variant="danger"
              onClick={() => setClearLeadsOpen(true)}
              disabled={importedCounts.data?.total_imported === 0}
            >
              <Trash2 className="h-4 w-4" /> Limpar leads importados
            </Button>
          </div>
        </Card>
      ) : null}

      <ConfirmModal
        open={clearLeadsOpen}
        title="Limpar leads importados"
        confirmText="EXCLUIR"
        confirmLabel="Limpar todos"
        loading={clearingLeads}
        onCancel={() => setClearLeadsOpen(false)}
        onConfirm={() => void clearImportedLeads()}
        message={
          <span>
            Você está prestes a excluir{" "}
            <strong className="text-rose-400 font-semibold">
              {importedCounts.data?.total_imported ?? 0} leads importados
            </strong>{" "}
            desta empresa (
            <strong className="text-amber-400 font-semibold">
              {importedCounts.data?.in_queue ?? 0} na fila
            </strong>
            ). Conversas, mensagens, opt-outs e gerações de IA vinculados também
            serão removidos. Digite{" "}
            <strong className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">EXCLUIR</strong> para confirmar.
            Esta ação não pode ser desfeita.
          </span>
        }
      />
    </div>
  );
}
