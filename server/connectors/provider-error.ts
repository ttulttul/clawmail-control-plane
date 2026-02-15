export type ProviderName = "mailchannels" | "agentmail";

export class ProviderHttpError extends Error {
  public readonly provider: ProviderName;
  public readonly status: number;
  public readonly path: string;
  public readonly body: string;

  public constructor(input: {
    provider: ProviderName;
    status: number;
    path: string;
    body: string;
  }) {
    super(`Provider ${input.provider} request failed with status ${input.status}`);
    this.name = "ProviderHttpError";
    this.provider = input.provider;
    this.status = input.status;
    this.path = input.path;
    this.body = input.body;
  }
}
