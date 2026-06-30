import { getProvider } from "../../providers";
import type { Logger } from "../../lib/logger";
import type { PaymentProvider } from "../../providers/base";
import type { Payment, PaymentRow, PaymentStatus } from "./schemas";
import { deserializePayment } from "./schemas";

// ── Routing ──────────────────────────────────────────────────────────────────

interface RoutingRule {
	if?: { currency?: string; amount_lte?: number; amount_gte?: number };
	use?: string;
	default?: string;
}

interface ResolvedProvider {
	providerId: string;
	providerSlug: string;
}

function evaluateRules(
	rules: RoutingRule[],
	params: { currency: string; amount: number },
): string | null {
	let defaultRoute: string | null = null;
	for (const rule of rules) {
		if (rule.default && !defaultRoute) {
			defaultRoute = rule.default;
			continue;
		}
		if (!rule.if || !rule.use) continue;
		const { currency, amount_lte, amount_gte } = rule.if;
		if (currency && currency !== params.currency) continue;
		if (amount_lte !== undefined && params.amount > amount_lte) continue;
		if (amount_gte !== undefined && params.amount < amount_gte) continue;
		return rule.use;
	}
	return defaultRoute;
}

export async function resolveProvider(
	db: D1Database,
	organizationId: string,
	currency: string,
	amount: number,
): Promise<ResolvedProvider | null> {
	const { results } = await db
		.prepare(
			`SELECT tp.provider_id, tp.routing_rules, tp.currencies, p.slug
       FROM tenant_providers tp
       JOIN providers p ON p.id = tp.provider_id
       WHERE tp.organization_id = ? AND p.enabled = 1
       ORDER BY tp.priority ASC`,
		)
		.bind(organizationId)
		.all<{ provider_id: string; routing_rules: string; currencies: string; slug: string }>();

	for (const row of results) {
		const currencies: string[] = JSON.parse(row.currencies);
		if (currencies.length > 0 && !currencies.includes(currency)) continue;

		const rules: RoutingRule[] = JSON.parse(row.routing_rules);
		if (rules.length === 0) {
			return { providerId: row.provider_id, providerSlug: row.slug };
		}

		const match = evaluateRules(rules, { currency, amount });
		if (match) {
			return { providerId: row.provider_id, providerSlug: row.slug };
		}
	}

	return null;
}

// ── Provider helpers ──────────────────────────────────────────────────────────

export async function getProviderSlug(db: D1Database, providerId: string): Promise<string> {
	const row = await db
		.prepare(`SELECT slug FROM providers WHERE id = ?`)
		.bind(providerId)
		.first<{ slug: string }>();
	if (!row) throw Object.assign(new Error(`Provider "${providerId}" not found`), { status: 500 });
	return row.slug;
}

// ── Credentials ───────────────────────────────────────────────────────────────

export async function loadProvider(
	kv: KVNamespace,
	providerSlug: string,
	organizationId: string,
	log?: Logger,
): Promise<PaymentProvider> {
	const credentials = await kv.get(`psp_creds:${providerSlug}:${organizationId}`);
	if (!credentials) {
		throw Object.assign(new Error(`No credentials found for provider "${providerSlug}"`), {
			status: 422,
		});
	}
	return getProvider(providerSlug, credentials, log);
}

// ── D1 helpers ────────────────────────────────────────────────────────────────

export async function getPaymentById(
	db: D1Database,
	id: string,
	organizationId: string,
): Promise<Payment | null> {
	const row = await db
		.prepare(`SELECT * FROM payments WHERE id = ? AND organization_id = ?`)
		.bind(id, organizationId)
		.first<PaymentRow>();

	return row ? deserializePayment(row) : null;
}

export async function getPaymentWithProviderSlug(
	db: D1Database,
	id: string,
	organizationId: string,
): Promise<{ payment: Payment; providerSlug: string } | null> {
	const row = await db
		.prepare(
			`SELECT pay.*, pr.slug AS provider_slug
       FROM payments pay
       JOIN providers pr ON pr.id = pay.provider_id
       WHERE pay.id = ? AND pay.organization_id = ?`,
		)
		.bind(id, organizationId)
		.first<PaymentRow & { provider_slug: string }>();

	if (!row) return null;
	const { provider_slug, ...paymentRow } = row;
	return { payment: deserializePayment(paymentRow), providerSlug: provider_slug };
}

export async function getPaymentByIdempotencyKey(
	db: D1Database,
	key: string,
	organizationId: string,
): Promise<Payment | null> {
	const row = await db
		.prepare(`SELECT * FROM payments WHERE idempotency_key = ? AND organization_id = ?`)
		.bind(key, organizationId)
		.first<PaymentRow>();

	return row ? deserializePayment(row) : null;
}

export async function insertPayment(
	db: D1Database,
	payment: Omit<Payment, "created_at" | "updated_at">,
): Promise<Payment> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO payments
         (id, organization_id, provider_id, provider_ref, amount, currency, status, redirect_url, idempotency_key, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			payment.id,
			payment.organization_id,
			payment.provider_id,
			payment.provider_ref,
			payment.amount,
			payment.currency,
			payment.status,
			payment.redirect_url ?? null,
			payment.idempotency_key ?? null,
			JSON.stringify(payment.metadata ?? {}),
			now,
			now,
		)
		.run();

	return { ...payment, created_at: now, updated_at: now };
}

export async function updatePaymentStatus(
	db: D1Database,
	payment: Payment,
	status: PaymentStatus,
	providerRef?: string,
): Promise<Payment> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`UPDATE payments
       SET status = ?, provider_ref = COALESCE(?, provider_ref), updated_at = ?
       WHERE id = ? AND organization_id = ?`,
		)
		.bind(status, providerRef ?? null, now, payment.id, payment.organization_id)
		.run();

	return {
		...payment,
		status,
		provider_ref: providerRef ?? payment.provider_ref,
		updated_at: now,
	};
}
