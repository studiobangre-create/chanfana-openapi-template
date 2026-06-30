import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { getAuth } from "./auth";
import { paymentsRouter } from "./endpoints/payments/router";
import { webhooksRouter } from "./endpoints/webhooks/router";
import { adminRouter } from "./endpoints/admin/router";

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

app.use("/api/auth/**", browserCors());
app.use("/admin/**", browserCors());

app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}
	console.error("Unhandled error:", err);
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

openapi.route("/v1/payments", paymentsRouter);
openapi.route("/webhooks", webhooksRouter);
openapi.route("/admin", adminRouter);

export default app;
