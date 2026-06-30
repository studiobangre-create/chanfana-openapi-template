export interface ChargeParams {
	amount: number;
	currency: string;
	metadata: Record<string, string>;
}

export interface CaptureParams {
	providerRef: string;
	amount?: number;
}

export interface RefundParams {
	providerRef: string;
	currency: string;
	originalAmount: number;
	amount?: number; // omit = full refund (uses originalAmount)
	reason?: string;
}

export interface CancelParams {
	providerRef: string;
}

export type ProviderStatus = "pending" | "authorized" | "succeeded" | "failed";

export interface ProviderResult {
	providerRef: string;
	status: ProviderStatus;
	// Redirect-based providers (e.g. Wave) return a URL the customer must open.
	// When present, the caller must surface this URL to the end user.
	redirectUrl?: string;
}

export interface PaymentProvider {
	charge(params: ChargeParams): Promise<ProviderResult>;
	capture(params: CaptureParams): Promise<ProviderResult>;
	refund(params: RefundParams): Promise<ProviderResult>;
	cancel(params: CancelParams): Promise<ProviderResult>;
}
