import type { PaymentProvider } from "./base";
import type { Logger } from "../lib/logger";
import { createPawaPayProvider } from "./momo";
import { createWaveProvider } from "./wave";

// Credentials are fetched from KV: key = "psp_creds:{slug}:{organizationId}"
// Each provider expects a JSON string with its own shape — see provider implementations.
//
// pawapay: { "apiToken": "...", "baseUrl": "https://api.pawapay.io" }
// wave:    { "apiKey": "wave_sn_prod_...", "signingSecret": "wave_sn_AKS_..." }
export function getProvider(slug: string, credentials: string, log?: Logger): PaymentProvider {
	switch (slug) {
		case "pawapay":
			return createPawaPayProvider(credentials, log);
		case "wave":
			return createWaveProvider(credentials, log);
		// case "stripe":
		//   return createStripeProvider(credentials);
		default:
			throw new Error(`Provider "${slug}" is not yet implemented`);
	}
}
