export type FailureCode =
  | "content_policy"
  | "provider_error"
  | "timeout"
  | "invalid_input"
  | "quota_exceeded"
  | "cancelled";

export type ArtifactRef = { url: string; role: "output" | "thumbnail" | "preview" };

export type ProviderStatus =
  | { state: "queued" }
  | { state: "processing"; pct?: number; stage?: string }
  | { state: "succeeded"; artifacts: ArtifactRef[] }
  | { state: "failed"; code: FailureCode; message: string; billable: boolean };

export type GenerationRequest = {
  modelId: string;
  prompt: string;
  kind: "video" | "image";
  aspect: string;
  durationSec?: number;
  idempotencyKey: string;
};

export type ProviderHandle = { provider: string; jobId: string };

export type SubmitCtx = { workspaceId: string };

export interface ModelProvider {
  readonly id: string;
  submit(req: GenerationRequest, ctx: SubmitCtx): Promise<ProviderHandle>;
  poll(handle: ProviderHandle): Promise<ProviderStatus>;
  parseWebhook?(payload: unknown, sig: string): ProviderStatus;
  resolveArtifacts(status: ProviderStatus): Promise<ArtifactRef[]>;
}
