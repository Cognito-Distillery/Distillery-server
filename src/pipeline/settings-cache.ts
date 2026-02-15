import { getPipelineSettingsFromDB, type PipelineSettings } from "./settings-service";

const CACHE_TTL_MS = 60_000;

let cachedSettings: PipelineSettings | null = null;
let cacheTimestamp = 0;

export async function getPipelineSettings(): Promise<PipelineSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  cachedSettings = await getPipelineSettingsFromDB();
  cacheTimestamp = Date.now();
  return cachedSettings;
}

export function invalidatePipelineSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
