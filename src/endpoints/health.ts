import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { HandleArgs } from "../types";

export class HealthCheck extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["System"],
		summary: "Health check",
		responses: {
			"200": {
				description: "Service is healthy",
				...contentJson(z.object({ status: z.literal("ok") })),
			},
		},
	};

	async handle(c: HandleArgs[0]) {
		return c.json({ status: "ok" as const }, 200);
	}
}
