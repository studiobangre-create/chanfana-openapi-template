import { createMiddleware } from "hono/factory";
import { Logger } from "../lib/logger";

export const requestLogger = () =>
	createMiddleware<{ Bindings: Env; Variables: { logger: Logger; requestId: string } }>(
		async (c, next) => {
			const requestId = crypto.randomUUID();
			const log = new Logger({ requestId });
			c.set("logger", log);
			c.set("requestId", requestId);

			const start = performance.now();
			await next();

			log.info("http", {
				method: c.req.method,
				path: new URL(c.req.url).pathname,
				status: c.res.status,
				latencyMs: Math.round(performance.now() - start),
			});
		},
	);
