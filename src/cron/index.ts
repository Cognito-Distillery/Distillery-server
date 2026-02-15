import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import { backfillIsolatedNodes } from "../cask";
import { logger } from "../logger";

export const cronPlugin = new Elysia({ name: "cron" })
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
