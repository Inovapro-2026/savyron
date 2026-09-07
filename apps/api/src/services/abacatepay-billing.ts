/**
 * Billing AbacatePay (SAVYRON) — lógica de negócio do gateway atual
 * (PIX manual, sem recorrência automática).
 *
 * Máquina de estados:
 *  - A empresa PENDING_PAYMENT/EXPIRED recebe um PIX novo a cada ciclo.
 *  - Business/Subscription SÓ são ativados com confirmação REAL do gateway
 *    (webhook transparent.completed / checkout.completed).
 *  - Renovação: +30 dias a partir do fim do período atual (assinatura ACTIVE)
 *    ou a partir de hoje (assinatura EXPIRED/atrasada).
 *  - Sem pagamento, o watchdog marca EXPIRED + Business SUSPENDED com
 *    suspension_reason='subscription_expired' (login -> /payment).
 *
 * Deduplicação: por id do evento (log_...) na rota; correlação pagamento->empresa
 * via metadata { businessId, subscriptionId } + abacatepay_checkout_id.
 */
import { prisma } from "@prospector/database";
import { createLogger } from "@prospector/logger";
import {
  createAbacatepayCustomer,
  createAbacatepayPix,
  getAbacatepayTransparentStatus,
  AbacatepayWebhookPayload,
  isAbacatepayConfigured,
  isValidBrazilianTaxId,
  AbacatePayNotConfiguredError,
} from "./abacatepay";
import { writeAudit } from "./audit";

const logger = createLogger("api.abacatepay-billing");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface AbacatepayPixResult {
  paymentId: string;
  amount: number;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string | null;
  checkoutId: string;
}

/** Gera um novo PIX de cobrança para o ciclo atual da empresa. Idempotente
 *  em relação ao PIX pendente: reutiliza um PENDING ainda não vencido. */
export async function createAbacatepayPixForBusiness(
  businessId: string,
): Promise<AbacatepayPixResult> {
  if (!isAbacatepayConfigured()) throw new AbacatePayNotConfiguredError();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });
  if (!business) throw new Error("Empresa não encontrada");

  const subscription = await prisma.subscription.findUnique({
    where: { business_id: businessId },
  });
  if (!subscription)
    throw new Error("Assinatura não configurada para o cadastro");

  const plan = subscription.plan_id
    ? await prisma.plan.findUnique({ where: { id: subscription.plan_id } })
    : null;
  const price = Number(subscription.plan_price ?? plan?.price ?? 0);
  if (price <= 0) throw new Error("Este plano é gratuito e não exige cobrança");

  // Reutiliza PIX pendente (mesmo ciclo) se ainda não venceu E o valor bater
  // com o preço atual do plano. Se o preço mudou (admin), o PIX antigo fica
  // com o valor incorreto — cancela e emite um novo.
  const pendingPayment = await prisma.payment.findFirst({
    where: {
      business_id: businessId,
      status: "PENDING",
      value: price,
      abacatepay_checkout_id: { not: null },
      created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { created_at: "desc" },
  });

  if (pendingPayment) {
    return {
      paymentId: pendingPayment.id,
      amount: Number(pendingPayment.value),
      brCode: pendingPayment.pix_payload ?? "",
      brCodeBase64: pendingPayment.pix_qr_base64 ?? "",
      expiresAt: pendingPayment.due_date?.toISOString() ?? null,
      checkoutId: pendingPayment.abacatepay_checkout_id ?? "",
    };
  }

  // PIX pendente com preço divergente: invalida no banco (não usa mais o QR
  // antigo); o gateway mesmo assim expira em 30 dias.
  await prisma.payment.updateMany({
    where: {
      business_id: businessId,
      status: "PENDING",
      abacatepay_checkout_id: { not: null },
      value: { not: price },
    },
    data: { status: "CANCELLED" },
  });

  // Cliente AbacatePay (criado uma vez, dedup por taxId no gateway).
  let customerId = subscription.abacatepay_customer_id;
  if (!customerId) {
    const customer = await createAbacatepayCustomer({
      email: business.email || subscription.id,
      name: business.name,
      cellphone: business.phone,
      taxId: isValidBrazilianTaxId(business.cnpj)
        ? business.cnpj!.replace(/\D/g, "")
        : undefined,
      metadata: { source: "savvyron-crm", businessId },
    });
    customerId = customer.id;
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { abacatepay_customer_id: customerId },
    });
  }

  const amountCents = Math.round(price * 100);

  // customer inline exige TODOS os campos (name, taxId válido, email,
  // cellphone) — omitimos se não tivermos os quatro com dados confiáveis.
  const customerInline =
    business.name?.trim() &&
    business.email?.trim() &&
    business.phone?.trim() &&
    isValidBrazilianTaxId(business.cnpj)
      ? {
          name: business.name.trim(),
          email: business.email.trim(),
          taxId: business.cnpj!.replace(/\D/g, ""),
          cellphone: business.phone.trim(),
        }
      : undefined;

  const pix = await createAbacatepayPix({
    amount: amountCents,
    expiresIn: 30 * 24 * 60 * 60,
    description: `Assinatura ${plan?.name ?? subscription.plan_name ?? "SAVYRON"} - ${business.name}`,
    externalId: `biz_${businessId}_${Date.now()}`,
    ...(customerInline ? { customer: customerInline } : {}),
    metadata: {
      businessId,
      subscriptionId: subscription.id,
      source: "savvyron-crm",
    },
  });

  const expiresAt = pix.expiresAt ? new Date(pix.expiresAt) : null;

  const payment = await prisma.payment.create({
    data: {
      subscription_id: subscription.id,
      business_id: businessId,
      abacatepay_checkout_id: pix.id,
      abacatepay_event: "transparent.completed",
      method: "PIX",
      status: "PENDING",
      value: price,
      due_date: expiresAt,
      pix_payload: pix.brCode,
      pix_qr_base64: pix.brCodeBase64,
      external_reference: businessId,
    },
  });

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { abacatepay_checkout_id: pix.id },
  });

  void writeAudit({
    actor: "abacatepay",
    businessId,
    action: "payment.pix_generated",
    entity: "Payment",
    entityId: payment.id,
    metadata: {
      provider: "abacatepay",
      checkout_id: pix.id,
      amount: price,
      status: "PENDING",
    },
  });

  logger.info("PIX AbacatePay gerado", {
    businessId,
    checkoutId: pix.id,
    paymentId: payment.id,
  });

  return {
    paymentId: payment.id,
    amount: price,
    brCode: pix.brCode,
    brCodeBase64: pix.brCodeBase64,
    expiresAt: expiresAt?.toISOString() ?? null,
    checkoutId: pix.id,
  };
}

// ---------------------------------------------------------------------------
// Webhook — resolução do evento
// ---------------------------------------------------------------------------

interface AbacatepayEventData {
  id?: unknown;
  status?: unknown;
  amount?: unknown;
  metadata?: Record<string, unknown>;
  customer?: unknown;
  taxId?: unknown;
}

/** Resolve a assinatura local a partir do payload (metadata -> cobrança). */
async function resolveSubscriptionFromEvent(
  data: AbacatepayEventData,
): Promise<{
  subscription: NonNullable<
    Awaited<ReturnType<typeof prisma.subscription.findUnique>>
  >;
  payment: Awaited<ReturnType<typeof prisma.payment.findUnique>> | null;
  via: string;
} | null> {
  const checkoutId = typeof data.id === "string" ? data.id : null;
  const businessIdFromMeta =
    typeof data.metadata?.businessId === "string"
      ? data.metadata.businessId
      : null;

  // 1) Pela cobrança já registrada localmente (abacatepay_checkout_id)
  if (checkoutId) {
    const payment = await prisma.payment.findUnique({
      where: { abacatepay_checkout_id: checkoutId },
    });
    if (payment) {
      const subscription = await prisma.subscription.findUnique({
        where: { id: payment.subscription_id },
      });
      if (subscription) {
        return { subscription, payment, via: "checkout_id" };
      }
    }
  }

  // 2) Por businessId no metadata (criado por nós ao gerar o PIX)
  if (businessIdFromMeta) {
    const subscription = await prisma.subscription.findUnique({
      where: { business_id: businessIdFromMeta },
    });
    if (subscription) {
      const payment = checkoutId
        ? await prisma.payment.findUnique({
            where: { abacatepay_checkout_id: checkoutId },
          })
        : null;
      return { subscription, payment, via: "metadata" };
    }
  }

  // 3) Fallback: subscription vinculada ao checkout id armazenado
  if (checkoutId) {
    const subscription = await prisma.subscription.findFirst({
      where: { abacatepay_checkout_id: checkoutId },
    });
    if (subscription)
      return { subscription, payment: null, via: "sub_checkout" };
  }

  return null;
}

/**
 * Confirma uma cobrança PIX e ativa/renova a empresa. IDEMPOTENTE por
 * pagamento: se a cobrança já estiver CONFIRMED, retorna { already: true }
 * sem repetir a extensão de período nem reativar nada. Usado tanto pelo
 * webhook (fonte primária) quanto pela consulta de status da tela de
 * pagamento ("Já paguei" / polling).
 */
export async function confirmAbacatepayPayment(input: {
  businessId: string;
  subscriptionId: string;
  checkoutId: string | null;
  paymentId: string | null;
  value: number;
  ts?: Date;
}): Promise<{ already: boolean }> {
  const { businessId, subscriptionId, checkoutId, paymentId, value } = input;
  const ts = input.ts ?? new Date();

  const existing = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId } })
    : checkoutId
      ? await prisma.payment.findUnique({
          where: { abacatepay_checkout_id: checkoutId },
        })
      : null;

  // Idempotência: mesma cobrança já confirmada não renova de novo.
  if (existing?.status === "CONFIRMED") return { already: true };

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription) throw new Error("Assinatura não encontrada");

  const isRenewal = subscription.status === "ACTIVE";
  const basePeriodEnd = subscription.current_period_end?.getTime() ?? Date.now();
  const periodStart = isRenewal ? new Date(basePeriodEnd) : ts;
  const periodEnd = new Date(periodStart.getTime() + THIRTY_DAYS_MS);

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.payment.update({
        where: { id: existing.id },
        data: { status: "CONFIRMED", paid_at: ts },
      });
    } else if (checkoutId) {
      await tx.payment.create({
        data: {
          subscription_id: subscriptionId,
          business_id: businessId,
          abacatepay_checkout_id: checkoutId,
          abacatepay_event: "transparent.completed",
          method: "PIX",
          status: "CONFIRMED",
          value,
          paid_at: ts,
          external_reference: businessId,
        },
      });
    }

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "ACTIVE",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        ...(checkoutId ? { abacatepay_checkout_id: checkoutId } : {}),
      },
    });

    await tx.business.update({
      where: { id: businessId },
      data: { status: "ACTIVE", suspension_reason: null },
    });
  });

  void writeAudit({
    actor: "abacatepay",
    businessId,
    action: "payment.confirmed",
    entity: "Payment",
    entityId: existing?.id ?? checkoutId ?? subscriptionId,
    metadata: {
      provider: "abacatepay",
      checkout_id: checkoutId,
      status: "CONFIRMED",
      via: isRenewal ? "renewal" : "activation",
    },
  });
  logger.info("Pagamento AbacatePay confirmado — empresa ativada/renovada", {
    businessId,
    checkoutId,
    renewal: isRenewal,
    periodEnd: periodEnd.toISOString(),
  });
  return { already: false };
}

/**
 * transparent.completed / checkout.completed — confirmação REAL do pagamento
 * (webhook). Delega a ativação a confirmAbacatepayPayment (idempotente): se o
 * gateway reenviar o mesmo evento, a cobrança já estará CONFIRMED e nada é
 * duplicado (mesma cobrança, mesma assinatura, mesmo período).
 */
export async function processAbacatepayCompleted(
  payload: AbacatepayWebhookPayload,
): Promise<boolean> {
  const data = (payload.data ?? {}) as AbacatepayEventData;
  const resolved = await resolveSubscriptionFromEvent(data);
  if (!resolved) {
    logger.warn("abacatepay.completed sem assinatura local", {
      id: data.id,
      businessId: data.metadata?.businessId,
    });
    return false;
  }
  const { subscription, payment } = resolved;
  const checkoutId = typeof data.id === "string" ? data.id : null;

  await confirmAbacatepayPayment({
    businessId: subscription.business_id,
    subscriptionId: subscription.id,
    checkoutId,
    paymentId: payment?.id ?? null,
    value: Number(payment?.value ?? subscription.plan_price ?? 0),
  });
  return true;
}

/** transparent.refunded / checkout.refunded — estorno do pagamento. */
export async function processAbacatepayRefunded(
  payload: AbacatepayWebhookPayload,
): Promise<boolean> {
  const data = (payload.data ?? {}) as AbacatepayEventData;
  const resolved = await resolveSubscriptionFromEvent(data);
  if (!resolved) {
    logger.warn("abacatepay.refunded sem assinatura local", {
      id: data.id,
      businessId: data.metadata?.businessId,
    });
    return false;
  }
  const { subscription, payment } = resolved;
  const checkoutId = typeof data.id === "string" ? data.id : null;

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
  }

  void writeAudit({
    actor: "abacatepay-webhook",
    businessId: subscription.business_id,
    action: "payment.refunded",
    entity: "Payment",
    entityId: payment?.id ?? checkoutId ?? subscription.id,
    metadata: {
      provider: "abacatepay",
      checkout_id: checkoutId,
      status: "REFUNDED",
    },
  });
  logger.info("Pagamento AbacatePay estornado", {
    businessId: subscription.business_id,
    checkoutId,
  });
  return true;
}

/**
 * Dispatcher de eventos AbacatePay. Mapeia os dois namespaces suportados
 * (checkout.* e transparent.*) para os mesmos handlers.
 */
export async function handleAbacatepayWebhookEvent(
  event: string,
  payload: AbacatepayWebhookPayload,
): Promise<boolean> {
  switch (event) {
    case "transparent.completed":
    case "checkout.completed":
      return processAbacatepayCompleted(payload);
    case "transparent.refunded":
    case "checkout.refunded":
      return processAbacatepayRefunded(payload);
    case "transparent.disputed":
    case "checkout.disputed":
      logger.info("Disputa AbacatePay (sem ação automática)", { event });
      return true;
    default:
      return false;
  }
}

/** Eventos que queremos processar (usados ao registrar o webhook). */
export const ABACATEPAY_WEBHOOK_EVENTS = [
  "transparent.completed",
  "transparent.refunded",
  "transparent.disputed",
] as const;

/** Marca a assinatura/business como suspensos por vencimento (sem pagamento). */
export async function expireSubscription(businessId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { business_id: businessId },
  });
  if (!subscription) return false;
  if (
    subscription.status === "EXPIRED" ||
    subscription.status === "CANCELLED"
  ) {
    return false;
  }

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "EXPIRED" },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: { status: "SUSPENDED", suspension_reason: "subscription_expired" },
    }),
  ]);

  void writeAudit({
    actor: "abacatepay-watchdog",
    businessId,
    action: "subscription.expired_by_watchdog",
    entity: "Subscription",
    entityId: subscription.id,
    metadata: { reason: "subscription_expired", status: "EXPIRED" },
  });
  logger.info("Assinatura expirada pelo watchdog", { businessId });
  return true;
}

// ---------------------------------------------------------------------------
// Consulta de status — "Já paguei" e polling (NUNCA cria cobrança)
// ---------------------------------------------------------------------------

export type AbacatepayPixStatus =
  | "PENDING"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "NOT_FOUND"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface AbacatepayPixStatusResult {
  status: AbacatepayPixStatus;
  paymentId?: string;
  checkoutId?: string;
  amount?: number;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string | null;
}

/**
 * Normaliza o status devolvido pelo gateway (/transparents/check):
 * PENDING, PAID, EXPIRED, CANCELLED, UNDER_DISPUTE, REFUNDED, REDEEMED,
 * APPROVED, FAILED (tolerante a variações).
 */
function normalizeGatewayStatus(
  raw: string,
): "paid" | "expired" | "cancelled" | "pending" {
  const s = String(raw ?? "").toUpperCase();
  if (/PAID|APPROVED|REDEEMED|COMPLETE|SUCCEEDED|CONFIRMED/.test(s))
    return "paid";
  if (/EXPIRED/.test(s)) return "expired";
  if (/CANCEL|REFUND|DISPUTE|FAILED/.test(s)) return "cancelled";
  return "pending";
}

/**
 * Consulta o status REAL do PIX existente no gateway (transparents/:id) e,
 * quando o gateway confirma o pagamento, ativa a assinatura de forma
 * idempotente. NÃO cria cobrança: apenas consulta a cobrança já existente
 * (mais recente) da empresa autenticada.
 */
export async function getAbacatepayPixStatus(
  businessId: string,
): Promise<AbacatepayPixStatusResult> {
  if (!isAbacatepayConfigured()) return { status: "NOT_CONFIGURED" };

  const payment = await prisma.payment.findFirst({
    where: { business_id: businessId },
    orderBy: { created_at: "desc" },
  });
  if (!payment?.abacatepay_checkout_id) {
    return { status: "NOT_FOUND", paymentId: payment?.id };
  }

  const base: Omit<AbacatepayPixStatusResult, "status"> = {
    paymentId: payment.id,
    checkoutId: payment.abacatepay_checkout_id,
    amount: Number(payment.value),
    brCode: payment.pix_payload ?? "",
    brCodeBase64: payment.pix_qr_base64 ?? "",
    expiresAt: payment.due_date?.toISOString() ?? null,
  };

  // Webhook já confirmou localmente (fonte primária) — retorna direto.
  if (payment.status === "CONFIRMED") return { status: "CONFIRMED", ...base };

  let ghostStatus: string | null = null;
  try {
    const ghost = await getAbacatepayTransparentStatus(
      payment.abacatepay_checkout_id,
    );
    ghostStatus = String(ghost.status ?? "");
  } catch (error) {
    logger.error("Falha ao consultar PIX AbacatePay no gateway", {
      businessId,
      checkoutId: payment.abacatepay_checkout_id,
      error,
    });
    return { status: "ERROR", ...base };
  }

  const kind = normalizeGatewayStatus(ghostStatus);
  if (kind === "paid") {
    const subscription = await prisma.subscription.findUnique({
      where: { business_id: businessId },
    });
    if (!subscription) return { status: "ERROR", ...base };
    await confirmAbacatepayPayment({
      businessId,
      subscriptionId: subscription.id,
      checkoutId: payment.abacatepay_checkout_id,
      paymentId: payment.id,
      value: Number(payment.value),
    });
    return { status: "CONFIRMED", ...base };
  }

  const expiredLocally =
    payment.due_date !== null && payment.due_date.getTime() < Date.now();
  if (kind === "expired" || expiredLocally) {
    // Só marca localmente se ainda estiver pendente (não sobrescreve CONFIRMED).
    if (payment.status === "PENDING") {
      await prisma.payment
        .update({ where: { id: payment.id }, data: { status: "OVERDUE" } })
        .catch(() => {});
    }
    return { status: "EXPIRED", ...base };
  }

  if (kind === "cancelled") {
    if (payment.status === "PENDING") {
      await prisma.payment
        .update({ where: { id: payment.id }, data: { status: "CANCELLED" } })
        .catch(() => {});
    }
    return { status: "CANCELLED", ...base };
  }

  return { status: "PENDING", ...base };
}
