import { createMiddleware } from "hono/factory";
import { getAuth } from "../auth";
import type { ApiKey } from "@better-auth/api-key";

export type VerifiedApiKey = { valid: true; error: null; key: Omit<ApiKey, "key"> };

export const requireApiKey = createMiddleware<{
	Bindings: Env;
	Variables: { apiKey: VerifiedApiKey };
}>(async (c, next) => {
	const raw = c.req.header("x-api-key");
	if (!raw) {
		return c.json({ success: false, error: "missing_api_key" }, 401);
	}

	const auth = getAuth(c.env);
	const result = await auth.api.verifyApiKey({
		body: { key: raw },
		headers: c.req.raw.headers,
	});

	if (!result.valid || !result.key) {
		return c.json({ success: false, error: "invalid_api_key" }, 401);
	}

	c.set("apiKey", result as VerifiedApiKey);
	await next();
});
