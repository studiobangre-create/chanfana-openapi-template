import type { Context } from "hono";
import type { Auth } from "./auth";
import type { ApiKey } from "@better-auth/api-key";
import type { Logger } from "./lib/logger";

type AuthInstance = Auth;
type Session = Awaited<ReturnType<AuthInstance["api"]["getSession"]>>;

export type HonoVariables = {
	session: NonNullable<Session>;
	apiKey: { valid: true; error: null; key: Omit<ApiKey, "key"> };
	logger: Logger;
	requestId: string;
};

export type AppContext = Context<{
	Bindings: Env;
	Variables: HonoVariables;
}>;

export type HandleArgs = [AppContext];
