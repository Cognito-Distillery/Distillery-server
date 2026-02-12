const messages = {
  MISSING_TOKEN: {
    ko: "출입증이 필요합니다.",
    en: "Access pass required.",
  },
  INVALID_TOKEN: {
    ko: "유효하지 않은 출입증입니다.",
    en: "Invalid access pass.",
  },
  OTP_SENT: {
    ko: "등록된 몰트스터라면 출입 코드가 발송됩니다.",
    en: "If registered, an entry code has been sent.",
  },
  INVALID_OTP: {
    ko: "출입 코드가 올바르지 않거나 만료되었습니다.",
    en: "Invalid or expired entry code.",
  },
  INVALID_REFRESH: {
    ko: "만료된 출입증입니다. 다시 인증해주세요.",
    en: "Expired pass. Please re-authenticate.",
  },
  MALT_NOT_FOUND: {
    ko: "해당 몰트를 찾을 수 없습니다.",
    en: "Malt not found.",
  },
  DRAW_BACK_NOT_ALLOWED: {
    ko: "증류 대기 상태의 몰트만 드로우백할 수 있습니다.",
    en: "Only queued malts can be drawn back.",
  },
  OTP_RATE_LIMITED: {
    ko: "잠시 후 다시 시도해주세요.",
    en: "Please try again later.",
  },
} as const;

type MessageKey = keyof typeof messages;
type Lang = "ko" | "en";

function parseLang(header?: string | null): Lang {
  if (!header) return "en";
  return header.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function msg(key: MessageKey, acceptLanguage?: string | null): string {
  const lang = parseLang(acceptLanguage);
  return messages[key][lang];
}
