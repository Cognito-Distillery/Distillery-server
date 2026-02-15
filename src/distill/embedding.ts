import { getEmbeddingProvider } from "../ai";
import { logger } from "../logger";

export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  try {
    const provider = await getEmbeddingProvider();
    return provider.generateEmbeddings(texts);
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
