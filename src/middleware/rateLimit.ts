import { createMiddleware } from "hono/factory";
import type { HonoVariables } from "../types";

export const rateLimitByApiKey = createMiddleware<{
	Bindings: Env;
	Variables: HonoVariables;
}>(async (c, next) => {
	const key = c.get("apiKey").key.id;
	const { success } = await c.env.RATE_LIMITER.limit({ key });
	if (!success) {
		return c.json({ success: false as const, error: "rate_limit_exceeded" }, 429);
	}
	await next();
});
