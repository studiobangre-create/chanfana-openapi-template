import { Hono } from "hono";
import { requireSession } from "../../middleware/requireSession";

const admin = new Hono<{ Bindings: Env }>();

admin.use("*", requireSession);

// Phase 5: tenant/provider management endpoints will be registered here

export { admin as adminRouter };
