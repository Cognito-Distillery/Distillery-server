import { Elysia, t } from "elysia";
import { accessJwt, refreshJwt } from "./guard";
import { generateOtp, storeOtp, verifyOtp, checkOtpRateLimit } from "./otp-store";
import { lookupUserByEmail, sendDirectMessage } from "./slack";
import { logger } from "../logger";
import { msg } from "../i18n";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(accessJwt)
  .use(refreshJwt)

  .post(
    "/send-otp",
    async ({ body, headers, set }) => {
      const lang = headers["accept-language"];
      const { email } = body;

      if (!checkOtpRateLimit(email)) {
        set.status = 429;
        return { error: msg("OTP_RATE_LIMITED", lang) };
      }

      const user = await lookupUserByEmail(email);

      if (user) {
        const otp = generateOtp();
        storeOtp(email, otp);
        try {
          await sendDirectMessage(
            user.id,
            `🥃 증류소 출입 코드: *${otp}*\n5분 내에 입력해주세요.`
          );
        } catch (err) {
          logger.error({ err, email }, "Failed to send OTP via Slack");
        }
      }

      return { message: msg("OTP_SENT", lang) };
    },
    { body: t.Object({ email: t.String({ format: "email" }) }) }
  )

  .post(
    "/verify-otp",
    async ({ body, headers, accessJwt, refreshJwt, set }) => {
      const lang = headers["accept-language"];
      const { email, otp } = body;

      if (!verifyOtp(email, otp)) {
        set.status = 401;
        return { error: msg("INVALID_OTP", lang) };
      }

      const user = await lookupUserByEmail(email);
      if (!user) {
        set.status = 401;
        return { error: msg("INVALID_OTP", lang) };
      }

      const payload = {
        sub: user.id,
        slackId: user.id,
        name: user.name,
        email: user.email,
      };

      const accessToken = await accessJwt.sign(payload);
      const refreshToken = await refreshJwt.sign({
        ...payload,
        type: "refresh",
      });

      return { accessToken, refreshToken };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        otp: t.String(),
      }),
    }
  )

  .post(
    "/refresh",
    async ({ body, headers, refreshJwt, accessJwt, set }) => {
      const lang = headers["accept-language"];
      const { refreshToken } = body;
      const payload = await refreshJwt.verify(refreshToken);

      if (!payload || payload.type !== "refresh") {
        set.status = 401;
        return { error: msg("INVALID_REFRESH", lang) };
      }

      const tokenPayload = {
        sub: payload.sub as string,
        slackId: payload.slackId as string,
        name: payload.name as string,
        email: payload.email as string,
      };

      const accessToken = await accessJwt.sign(tokenPayload);
      const newRefreshToken = await refreshJwt.sign({
        ...tokenPayload,
        type: "refresh",
      });

      return { accessToken, refreshToken: newRefreshToken };
    },
    { body: t.Object({ refreshToken: t.String() }) }
  );
