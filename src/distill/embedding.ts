import OpenAI from "openai";
import { logger } from "../logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  } catch (err) {
    logger.warn({ err }, "Failed to generate embeddings, returning nulls");
    return texts.map(() => null);
  }
}

export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  const [result] = await generateEmbeddings([text]);
  return result;
}
