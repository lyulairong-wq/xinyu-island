export interface GenerationRequest {
  conversationId: string;
  content: string;
  mode: "free" | "token";
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
