import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { distillMalts } from "../distill";
import { caskMalts, backfillIsolatedNodes } from "../cask";
import { logger } from "../logger";

export const cronPlugin = new Elysia({ name: "cron" })
  .use(
    cron({
      name: "distill-and-cask",
      pattern: "0 0,12 * * *", // 매일 00:00, 12:00
      async run() {
        logger.info("Cron: distill-and-cask started");
        try {
          await distillMalts();
          await caskMalts();
        } catch (err) {
          logger.error({ err }, "Cron: distill-and-cask failed");
        }
      },
    })
  )
  .use(
    cron({
      name: "backfill",
      pattern: "0 3 * * 0", // 매주 일요일 03:00
      async run() {
        logger.info("Cron: backfill started");
        try {
          await backfillIsolatedNodes();
        } catch (err) {
          logger.error({ err }, "Cron: backfill failed");
        }
      },
    })
  );
