export interface GenerationRequest {
  conversationId: string;
  content: string;
  mode: "free" | "token";
  systemPrompt?: string;
}

export interface GenerationEvent {
  type: "started" | "delta" | "completed" | "failed";
  text?: string;
  errorCode?: string;
}

export interface AiProvider {
  generate(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  healthCheck(): Promise<{ available: boolean }>;
}

export class MockAiProvider implements AiProvider {
  constructor(private readonly name = "心屿 AI") {}

  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: "started" };
    const content = request.content.trim();
    const text = content.includes("你好") || content.includes("嗨")
      ? `你好，我是${this.name}。今天想从哪里开始聊？`
      : content.endsWith("吗") || content.includes("？")
        ? `我听见你的好奇了。关于“${content.slice(0, 28)}”，我们可以先从你最在意的部分慢慢聊起。`
        : `嗯，我在听。你刚刚提到“${content.slice(0, 32)}”，这件事对你来说似乎有些特别。愿意再多说一点吗？`;
    yield { type: "delta", text };
    yield { type: "completed", text };
  }

  async healthCheck(): Promise<{ available: boolean }> {
    return { available: true };
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly baseUrl: string, private readonly model: string, private readonly timeoutMs = 30_000) {}

  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: "started" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages: [
            ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
            { role: "user", content: request.content }
          ]
        })
      });
      if (!response.ok) throw new Error(`free model returned ${response.status}`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("free model returned empty content");
      yield { type: "delta", text };
      yield { type: "completed", text };
    } catch (error) {
      yield { type: "failed", errorCode: error instanceof Error ? error.message : "FREE_MODEL_ERROR" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<{ available: boolean }> {
    return { available: Boolean(this.baseUrl && this.model) };
  }
}
