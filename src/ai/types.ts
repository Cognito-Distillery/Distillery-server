export type AIProvider = "openai" | "google";

export type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large";

export type ChatModel =
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gpt-4.1-mini"
  | "gemini-2.0-flash"
  | "gemini-2.5-flash";

export type AISettings = {
  embeddingModel: EmbeddingModel;
  chatProvider: AIProvider;
  chatModel: ChatModel;
};

export const EMBEDDING_MODELS_BY_PROVIDER: Record<"openai", EmbeddingModel[]> = {
  openai: ["text-embedding-3-small", "text-embedding-3-large"],
};

export const CHAT_MODELS_BY_PROVIDER: Record<AIProvider, ChatModel[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  google: ["gemini-2.0-flash", "gemini-2.5-flash"],
};

export type EmbeddingProvider = {
  generateEmbeddings(texts: string[]): Promise<(number[] | null)[]>;
};

export type ChatProvider = {
  chatCompletion(opts: {
    model: string;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature: number;
    responseFormat?: "json";
  }): Promise<string>;
};
