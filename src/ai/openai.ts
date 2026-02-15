import OpenAI from "openai";
import type { EmbeddingProvider, ChatProvider } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function createOpenAIEmbeddingProvider(model: string): EmbeddingProvider {
  return {
    async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
      const response = await openai.embeddings.create({
        model,
        input: texts,
        dimensions: 1536,
      });
      return response.data.map((d) => d.embedding);
    },
  };
}

export function createOpenAIChatProvider(): ChatProvider {
  return {
    async chatCompletion(opts): Promise<string> {
      const response = await openai.chat.completions.create({
        model: opts.model,
        temperature: opts.temperature,
        messages: opts.messages,
        ...(opts.responseFormat === "json"
          ? { response_format: { type: "json_object" } }
          : {}),
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from OpenAI");
      return content;
    },
  };
}
