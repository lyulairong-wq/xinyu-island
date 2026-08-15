export interface GenerationRequest {
  conversationId: string;
  content: string;
  mode: "free" | "token";
  maxOutputTokens: number;
  systemPrompt?: string;
}

export type GenerationFailureCode = "TIMEOUT" | "UNAVAILABLE" | "EMPTY_RESPONSE";

export interface GenerationEvent {
  type: "started" | "delta" | "completed" | "failed";
  text?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: GenerationFailureCode;
}

export interface AiProvider {
  generate(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  healthCheck(): Promise<{ available: boolean }>;
}

export class MockAiProvider implements AiProvider {
  private readonly name = "心屿助手";

  constructor(_contactName?: string) {}

  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: "started", provider: "mock" };
    const content = request.content.trim();
    const text = content.includes("你好") || content.includes("嗨")
      ? `你好，我是${this.name}。今天想从哪里开始聊？`
      : content.endsWith("吗") || content.includes("？")
        ? `我听见你的好奇了。关于“${content.slice(0, 28)}”，我们可以先从你最在意的部分慢慢聊起。`
        : `嗯，我在听。你刚刚提到“${content.slice(0, 32)}”，这件事对你来说似乎有些特别。愿意再多说一点吗？`;
    yield { type: "delta", text, provider: "mock" };
    yield { type: "completed", text, provider: "mock" };
  }

  async healthCheck(): Promise<{ available: boolean }> {
    return { available: true };
  }
}

export interface OpenAiCompatibleProviderOptions {
  timeoutMs?: number;
  apiKey?: string;
}

export class OpenAiCompatibleProvider implements AiProvider {
  private readonly timeoutMs: number;
  private readonly apiKey?: string;

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    options: OpenAiCompatibleProviderOptions | number = {}
  ) {
    this.timeoutMs = typeof options === "number" ? options : (options.timeoutMs ?? 30_000);
    this.apiKey = typeof options === "number" ? undefined : options.apiKey;
  }

  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: "started", provider: this.model };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          max_tokens: request.maxOutputTokens,
          messages: [
            ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
            { role: "user", content: request.content }
          ]
        })
      });
      if (!response.ok) throw new Error("UNAVAILABLE");
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("EMPTY_RESPONSE");
      yield { type: "delta", text, provider: this.model };
      yield {
        type: "completed",
        text,
        provider: this.model,
        ...(typeof data.usage?.prompt_tokens === "number" ? { inputTokens: data.usage.prompt_tokens } : {}),
        ...(typeof data.usage?.completion_tokens === "number" ? { outputTokens: data.usage.completion_tokens } : {})
      };
    } catch (error) {
      const errorCode: GenerationFailureCode = error instanceof DOMException && error.name === "AbortError"
        ? "TIMEOUT"
        : error instanceof Error && error.message === "EMPTY_RESPONSE"
          ? "EMPTY_RESPONSE"
          : "UNAVAILABLE";
      yield { type: "failed", provider: this.model, errorCode };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<{ available: boolean }> {
    return { available: Boolean(this.baseUrl && this.model) };
  }
}
