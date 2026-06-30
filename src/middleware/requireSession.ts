import { createMiddleware } from "hono/factory";
import { getAuth } from "../auth";

export const requireSession = createMiddleware<{
	Bindings: Env;
	Variables: { session: NonNullable<Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>> };
}>(async (c, next) => {
	const auth = getAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ success: false, error: "unauthorized" }, 401);
	}
	c.set("session", session);
	await next();
});
