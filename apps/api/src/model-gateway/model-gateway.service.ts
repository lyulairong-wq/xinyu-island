import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { MockAiProvider, OpenAiCompatibleProvider, type AiProvider, type GenerationRequest } from "@xinyu/ai";
import type { AppConfig } from "@xinyu/config";
import { estimateTokens, MAX_CONCURRENT_MODEL_GENERATIONS, sanitizeTokenCount } from "./model-limits";

type ProviderName = "primary" | "local" | "mock";

export interface ModelGatewayResult {
  text: string;
  provider: ProviderName;
  degraded: boolean;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelGatewayProviders {
  primary?: AiProvider;
  local?: AiProvider;
  mock?: AiProvider;
}

class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.available = permits;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }

    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
      return;
    }
    this.available += 1;
  }
}

@Injectable()
export class ModelGatewayService {
  private readonly providers: Required<Pick<ModelGatewayProviders, "mock">> & Omit<ModelGatewayProviders, "mock">;
  private readonly semaphore = new Semaphore(MAX_CONCURRENT_MODEL_GENERATIONS);

  constructor(providers: ModelGatewayProviders = {}) {
    this.providers = { ...providers, mock: providers.mock ?? new MockAiProvider() };
  }

  static fromConfig(config: AppConfig): ModelGatewayService {
    const { baseUrl, model, apiKey, timeoutMs } = config.freeModel;
    const local = baseUrl && model
      ? new OpenAiCompatibleProvider(baseUrl, model, { apiKey, timeoutMs })
      : undefined;

    return new ModelGatewayService({ local });
  }

  async generate(input: GenerationRequest): Promise<ModelGatewayResult> {
    const attempts: Array<[ProviderName, AiProvider | undefined]> = [
      ["primary", this.providers.primary],
      ["local", this.providers.local],
      ["mock", this.providers.mock]
    ];

    for (const [name, provider] of attempts) {
      if (!provider) continue;
      const result = await this.generateFromProvider(name, provider, input);
      if (result) return result;
    }

    throw new ServiceUnavailableException({ code: "MODEL_UNAVAILABLE" });
  }

  private async generateFromProvider(name: ProviderName, provider: AiProvider, input: GenerationRequest): Promise<ModelGatewayResult | undefined> {
    const usesPermit = name !== "mock";
    if (usesPermit) await this.semaphore.acquire();

    try {
      if (!(await provider.healthCheck()).available) return undefined;

      let deltaText = "";
      for await (const event of provider.generate(input)) {
        if (event.type === "failed") return undefined;
        if (event.type === "delta" && event.text) deltaText += event.text;
        if (event.type !== "completed") continue;

        const text = (event.text ?? deltaText).trim();
        if (!text) return undefined;

        return {
          text,
          provider: name,
          degraded: name !== "primary",
          inputTokens: sanitizeTokenCount(event.inputTokens, estimateTokens(input.content)),
          outputTokens: sanitizeTokenCount(event.outputTokens, estimateTokens(text))
        };
      }
    } catch {
      return undefined;
    } finally {
      if (usesPermit) this.semaphore.release();
    }

    return undefined;
  }
}
