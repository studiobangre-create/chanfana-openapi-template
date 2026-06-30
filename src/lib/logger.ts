type LogLevel = "debug" | "info" | "warn" | "error";

// Values for these keys must never appear in logs
const SENSITIVE_KEYS = new Set([
	"apiToken",
	"apiKey",
	"signingSecret",
	"authorization",
	"Authorization",
	"phoneNumber",
	"phoneNUmber", // typo present in pawaPay types
	"restrict_payer_mobile",
	"password",
	"secret",
	"token",
	"key",
]);

function redact(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
	if (depth > 4) return { "[depth_limit]": true };
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (SENSITIVE_KEYS.has(k)) {
			out[k] = "[REDACTED]";
		} else if (Array.isArray(v)) {
			out[k] = v;
		} else if (v !== null && typeof v === "object") {
			out[k] = redact(v as Record<string, unknown>, depth + 1);
		} else {
			out[k] = v;
		}
	}
	return out;
}

export interface LogContext extends Record<string, unknown> {
	requestId?: string;
	orgId?: string;
	paymentId?: string;
	provider?: string;
}

export class Logger {
	private readonly bound: LogContext;

	constructor(ctx: LogContext = {}) {
		this.bound = ctx;
	}

	with(extra: LogContext): Logger {
		return new Logger({ ...this.bound, ...extra });
	}

	private emit(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
		const entry: Record<string, unknown> = {
			ts: new Date().toISOString(),
			level,
			msg,
			...this.bound,
			...(fields ? redact(fields) : undefined),
		};
		const line = JSON.stringify(entry);
		if (level === "error") console.error(line);
		else if (level === "warn") console.warn(line);
		else console.log(line);
	}

	debug(msg: string, fields?: Record<string, unknown>): void {
		this.emit("debug", msg, fields);
	}
	info(msg: string, fields?: Record<string, unknown>): void {
		this.emit("info", msg, fields);
	}
	warn(msg: string, fields?: Record<string, unknown>): void {
		this.emit("warn", msg, fields);
	}
	error(msg: string, fields?: Record<string, unknown>): void {
		this.emit("error", msg, fields);
	}
}

export const rootLogger = new Logger();
