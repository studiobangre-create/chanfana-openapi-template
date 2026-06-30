import { Hono } from "hono";
import { requireApiKey } from "../../middleware/requireApiKey";

const payments = new Hono<{ Bindings: Env }>();

payments.use("*", requireApiKey);

// Phase 2: payment endpoints will be registered here

export { payments as paymentsRouter };
