"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { request } from "@/hooks/use-api";

interface PixResult {
  paymentId: string;
  amount: number;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string | null;
  checkoutId: string;
}

interface PixStatusResult {
  status:
    | "PENDING"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELLED"
    | "NOT_FOUND"
    | "ERROR"
    | "NOT_CONFIGURED";
  paymentId?: string;
  checkoutId?: string;
  amount?: number;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string | null;
}

type Phase =
  | "loading"
  | "pending"
  | "checking"
  | "confirmed"
  | "activating"
  | "expired"
  | "cancelled"
  | "create_error";

interface PixCheckoutProps {
  /** Chamado quando o backend confirma o pagamento (status CONFIRMED). */
  onPaid?: () => void;
  /** Título exibido no cartão. */
  title?: string;
}

const POLL_INTERVAL_MS = 6000;

/**
 * PixCheckout — exibe o PIX AbacatePay (QR + copia-e-cola) e acompanha o
 * pagamento ATÉ o gateway confirmar.
 *
 * - O botão "Já paguei" e o polling chamam SOMENTE a rota de CONSULTA
 *   (/billing/abacatepay/pix/status), que verifica o status real no gateway —
 *   nunca criam cobrança e nunca ativam pela confiança no cliente.
 * - A cobrança só é criada uma vez, na montagem (reutiliza o PIX pendente),
 *   ou de forma EXPLÍCITA pelo usuário quando o PIX expira/cancela.
 * - Polling único: para em confirmed/expired/cancelled e no unmount.
 */
export function PixCheckout({
  onPaid,
  title = "Pague via PIX",
}: PixCheckoutProps) {
  const [pix, setPix] = useState<PixResult | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  const pixRef = useRef<PixResult | null>(null);

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyStatus = useCallback(
    (result: PixStatusResult) => {
      stopPolling();
      switch (result.status) {
        case "CONFIRMED": {
          setStatusError(null);
          setPhase("confirmed");
          window.setTimeout(() => {
            setPhase("activating");
            onPaidRef.current?.();
          }, 700);
          return;
        }
        case "EXPIRED":
          setStatusError(null);
          setPhase("expired");
          return;
        case "CANCELLED":
          setStatusError(null);
          setPhase("cancelled");
          return;
        case "PENDING": {
          if (
            result.paymentId &&
            result.brCode &&
            (!pixRef.current ||
              pixRef.current.paymentId !== result.paymentId)
          ) {
            const next: PixResult = {
              paymentId: result.paymentId,
              amount: result.amount ?? pixRef.current?.amount ?? 0,
              brCode: result.brCode,
              brCodeBase64: result.brCodeBase64 ?? "",
              expiresAt: result.expiresAt ?? null,
              checkoutId: result.checkoutId ?? "",
            };
            pixRef.current = next;
            setPix(next);
          }
          setStatusError(null);
          setPhase("pending");
          return;
        }
        case "ERROR":
          setStatusError(
            "Não foi possível verificar o pagamento. Tente novamente.",
          );
          setPhase("pending");
          return;
        default: // NOT_FOUND / NOT_CONFIGURED
          setStatusError(
            result.status === "NOT_FOUND"
              ? "Nenhum PIX encontrado para esta conta."
              : "Gateway de pagamento não configurado.",
          );
          setPhase("pending");
      }
    },
    [stopPolling],
  );

  const runStatusCheck = useCallback(
    async (busy: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (busy) {
        setPhase("checking");
        setStatusError(null);
      }
      try {
        const result = await request<PixStatusResult>(
          "billing/abacatepay/pix/status",
        );
        applyStatus(result);
      } catch (err) {
        setStatusError(
          err instanceof Error && err.message
            ? err.message
            : "Não foi possível verificar o pagamento. Tente novamente.",
        );
        setPhase((prev) => (prev === "checking" ? "pending" : prev));
      } finally {
        inFlightRef.current = false;
      }
    },
    [applyStatus],
  );

  const generatePix = useCallback(async () => {
    stopPolling();
    setPhase("loading");
    setStatusError(null);
    try {
      const result = await request<PixResult>("billing/abacatepay/pix", {
        method: "POST",
        body: {},
      });
      pixRef.current = result;
      setPix(result);
      setPhase("pending");
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : "Falha ao gerar o PIX",
      );
      setPhase("create_error");
    }
  }, [stopPolling]);

  useEffect(() => {
    void generatePix();
  }, [generatePix]);

  // Polling único: só roda na fase "pending" (ERRO mantém "pending" e segue
  // tentando). A troca de fase para confirmed/expired/cancelled ou o unmount
  // faz o cleanup parar o intervalo. inFlightRef evita requisições paralelas.
  useEffect(() => {
    if (phase !== "pending") {
      stopPolling();
      return;
    }
    if (!pollRef.current) {
      const tick = () => void runStatusCheck(false);
      tick();
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    }
    return stopPolling;
  }, [phase, runStatusCheck, stopPolling]);

  const copyCode = async () => {
    if (!pix?.brCode) return;
    try {
      await navigator.clipboard.writeText(pix.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const formattedAmount = (amount: number) =>
    `R$ ${amount.toFixed(2).replace(".", ",")}`;

  const pixBody = pix ? (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pix.brCodeBase64}
          alt="QR Code PIX"
          className="h-52 w-52 rounded-2xl border-2 border-[#00E5FF]/40 bg-white p-3 shadow-2xl shadow-[#00E5FF]/10"
        />
      </div>

      <div className="text-center text-sm text-slate-400">
        Valor:{" "}
        <span className="font-bold text-white">
          {formattedAmount(pix.amount)}
        </span>
        {pix.expiresAt ? (
          <span className="mx-1 text-slate-600">·</span>
        ) : null}
        {pix.expiresAt ? (
          <span>
            Vence em{" "}
            {new Date(pix.expiresAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#020409]/60 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Copia e cola
        </div>
        <p className="mb-3 break-all rounded-lg border border-white/5 bg-[#080D18] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
          {pix.brCode}
        </p>
        <Button
          variant="outline"
          className="w-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
          onClick={() => void copyCode()}
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "PIX copiado!" : "Copiar código PIX"}
        </Button>
      </div>

      <div className="rounded-xl border border-[#00E5A0]/30 bg-[#00E5A0]/10 px-4 py-3 text-sm text-[#00E5A0]">
        Após pagar, o acesso é liberado automaticamente em alguns segundos.
      </div>

      <Button
        variant="outline"
        className="w-full border-white/10 bg-[#008CFF]/15 text-[#00E5FF] hover:bg-[#008CFF]/25 shadow-[0_0_15px_rgba(0,140,255,0.2)]"
        onClick={() => void runStatusCheck(true)}
        loading={phase === "checking"}
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {phase === "checking"
          ? "Verificando pagamento..."
          : "Já paguei — verificar pagamento"}
      </Button>
    </div>
  ) : null;

  return (
    <Card className="p-6 border-white/10 bg-[#080D18]/90 backdrop-blur-xl">
      <h2 className="mb-4 text-center font-display text-lg font-bold text-white">
        {title}
      </h2>

      {statusError ? (
        <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {statusError}
        </div>
      ) : null}

      {phase === "loading" ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <RefreshCw className="h-6 w-6 animate-spin text-[#008CFF]" />
          <p className="text-sm text-slate-400">Gerando seu PIX...</p>
        </div>
      ) : null}

      {phase === "create_error" ? (
        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            {statusError ?? "Falha ao gerar o PIX"}
          </div>
          <Button
            variant="outline"
            className="w-full border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => void generatePix()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {phase === "confirmed" || phase === "activating" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00E5A0]/50 bg-[#00E5A0]/20 shadow-[0_0_20px_rgba(0,229,160,0.3)]">
            <CheckCircle2 className="h-7 w-7 text-[#00E5A0]" />
          </div>
          <p className="text-lg font-bold text-white">
            Pagamento confirmado ✓
          </p>
          <p className="text-sm text-slate-400">
            {phase === "activating"
              ? "Ativando sua assinatura..."
              : "Inicializando seu ambiente neural..."}
          </p>
          {phase === "activating" ? (
            <RefreshCw className="h-5 w-5 animate-spin text-[#00E5A0]" />
          ) : null}
        </div>
      ) : null}

      {phase === "expired" ? (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Este PIX expirou. O QR Code não aceita mais pagamento — gere uma
              nova cobrança para continuar.
            </span>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold shadow-[0_0_20px_rgba(0,140,255,0.3)] hover:brightness-110"
            onClick={() => void generatePix()}
          >
            Gerar novo PIX
          </Button>
        </div>
      ) : null}

      {phase === "cancelled" ? (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Este PIX foi cancelado. Gere uma nova cobrança para continuar.
            </span>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-[#008CFF] to-[#00E5FF] text-black font-bold shadow-[0_0_20px_rgba(0,140,255,0.3)] hover:brightness-110"
            onClick={() => void generatePix()}
          >
            Gerar novo PIX
          </Button>
        </div>
      ) : null}

      {(phase === "pending" || phase === "checking") && pix ? pixBody : null}
    </Card>
  );
}