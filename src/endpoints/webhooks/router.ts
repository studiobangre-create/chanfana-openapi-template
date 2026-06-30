import { Hono } from "hono";

const webhooks = new Hono<{ Bindings: Env }>();

// Phase 3: per-provider webhook receivers will be registered here
// No auth — each handler verifies the PSP's HMAC signature itself

export { webhooks as webhooksRouter };
