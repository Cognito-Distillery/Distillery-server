import { getPipelineSettings } from "./settings-cache";
import { runPipeline } from "./service";
import { logger } from "../logger";

let timerId: ReturnType<typeof setTimeout> | null = null;

function scheduleNext(intervalMinutes: number): void {
  const ms = intervalMinutes * 60 * 1000;
  timerId = setTimeout(async () => {
    try {
      await runPipeline();
    } catch (err) {
      logger.error({ err }, "Scheduler: pipeline run failed");
    }
    try {
      const settings = await getPipelineSettings();
      scheduleNext(settings.intervalMinutes);
    } catch (err) {
      logger.error({ err }, "Scheduler: failed to read settings, using previous interval");
      scheduleNext(intervalMinutes);
    }
  }, ms);
}

export async function startScheduler(): Promise<void> {
  const settings = await getPipelineSettings();
  logger.info({ intervalMinutes: settings.intervalMinutes }, "Scheduler started");
  scheduleNext(settings.intervalMinutes);
}

export async function reschedule(): Promise<void> {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  const settings = await getPipelineSettings();
  logger.info({ intervalMinutes: settings.intervalMinutes }, "Scheduler rescheduled");
  scheduleNext(settings.intervalMinutes);
}
