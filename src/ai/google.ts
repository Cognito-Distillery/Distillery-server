import { GoogleGenAI } from "@google/genai";
import type { ChatProvider } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export function createGoogleChatProvider(): ChatProvider {
  return {
    async chatCompletion(opts): Promise<string> {
      const systemMessage = opts.messages.find((m) => m.role === "system");
      const userMessages = opts.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "model", parts: [{ text: m.content }] }));

      const response = await ai.models.generateContent({
        model: opts.model,
        contents: userMessages,
        config: {
          temperature: opts.temperature,
          ...(systemMessage ? { systemInstruction: systemMessage.content } : {}),
          ...(opts.responseFormat === "json"
            ? { responseMimeType: "application/json" }
            : {}),
        },
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from Google AI");
      return text;
    },
  };
}
