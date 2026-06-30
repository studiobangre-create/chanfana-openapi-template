import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";

// Plugins are defined at module level so their types flow through to getAuth's return type
const plugins = [
	organization(),
	apiKey({
		defaultPrefix: "psp_",
		enableMetadata: true,
	}),
];

const emailAndPassword = { enabled: true } as const;

// Derive the full typed Auth from a representative call so plugin endpoints
// (e.g. auth.api.verifyApiKey) are visible to TypeScript.
type Auth = ReturnType<
	typeof betterAuth<{
		database: D1Database;
		secret: string;
		baseURL: string;
		emailAndPassword: typeof emailAndPassword;
		plugins: typeof plugins;
	}>
>;

let _auth: Auth | undefined;

export function getAuth(env: Env): Auth {
	if (_auth) return _auth;
	_auth = betterAuth({
		database: env.DB,
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		emailAndPassword,
		plugins,
	}) as Auth;
	return _auth;
}

export type { Auth };
