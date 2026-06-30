import { fromHono } from "chanfana";
import { Hono } from "hono";
import { requireApiKey } from "../../middleware/requireApiKey";
import { CancelPayment } from "./cancel";
import { CapturePayment } from "./capture";
import { CreatePayment } from "./create";
import { GetPayment } from "./get";
import { RefundPayment } from "./refund";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requireApiKey);

const payments = fromHono(app);

payments.post("/", CreatePayment);
payments.get("/:id", GetPayment);
payments.post("/:id/capture", CapturePayment);
payments.post("/:id/refund", RefundPayment);
payments.post("/:id/cancel", CancelPayment);

export { app as paymentsRouter };
