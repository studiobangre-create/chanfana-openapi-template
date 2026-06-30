import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { getAuth } from "./auth";
import { HealthCheck } from "./endpoints/health";
import { paymentsRouter } from "./endpoints/payments/router";
import { webhooksRouter } from "./endpoints/webhooks/router";
import { adminRouter } from "./endpoints/admin/router";
import { requestLogger } from "./middleware/requestLogger";
import { rootLogger } from "./lib/logger";

const app = new Hono<{ Bindings: Env }>();

// CORS only on browser-facing routes (/api/auth/* and /admin/*) with an explicit
// origin allowlist. Wildcard + credentials is rejected by browsers and insecure.
// Webhook receivers (/webhooks/*) are PSP server-to-server — no CORS needed.
// Payment API (/v1/*) is called server-to-server with x-api-key — no CORS needed.
const browserCors = () =>
	cors({
		origin: (origin, c) => {
			const allowed = (c.env.CORS_ALLOWED_ORIGINS ?? "")
				.split(",")
				.map((o: string) => o.trim())
				.filter(Boolean);
			return allowed.includes(origin) ? origin : null;
		},
		credentials: true,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
	});

app.use("*", requestLogger());
app.use("/api/auth/**", browserCors());
app.use("/admin/**", browserCors());

app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}
	// onError context is untyped — safe cast to retrieve the request-scoped logger if set
	const log = (c as unknown as { get(k: string): unknown }).get("logger");
	const activeLog = log instanceof Object && "error" in log
		? (log as typeof rootLogger)
		: rootLogger;
	activeLog.error("unhandled error", {
		error: err instanceof Error ? err.message : String(err),
		stack: err instanceof Error ? err.stack : undefined,
		method: c.req.method,
		path: new URL(c.req.url).pathname,
	});
	return c.json(
		{ success: false, errors: [{ code: 7000, message: "Internal Server Error" }] },
		500,
	);
});

// better-auth handles all session, user, org, and API key management
app.on(["GET", "POST"], "/api/auth/**", (c) => {
	const auth = getAuth(c.env);
	return auth.handler(c.req.raw);
});

// Setup OpenAPI registry for documented routes
const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: "PSP Proxy API",
			version: "1.0.0",
			description: "Payment Service Provider proxy for B2B SaaS products.",
		},
	},
});

openapi.get("/health", HealthCheck);
openapi.route("/v1/payments", paymentsRouter);
app.route("/webhooks", webhooksRouter);
app.route("/admin", adminRouter);

export default app;
