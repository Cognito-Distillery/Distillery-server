const otpMap = new Map<string, { otp: string; expiresAt: number }>();
const rateLimitMap = new Map<string, number>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export function generateOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

export function storeOtp(email: string, otp: string): void {
  otpMap.set(email, { otp, expiresAt: Date.now() + OTP_TTL_MS });
}

export function verifyOtp(email: string, otp: string): boolean {
  const entry = otpMap.get(email);
  if (!entry) return false;
  otpMap.delete(email); // one-time use
  if (Date.now() > entry.expiresAt) return false;
  return entry.otp === otp;
}

export function checkOtpRateLimit(email: string): boolean {
  const lastSent = rateLimitMap.get(email);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    return false;
  }
  rateLimitMap.set(email, Date.now());
  return true;
}

// Purge expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpMap) {
    if (now > entry.expiresAt) otpMap.delete(email);
  }
  for (const [email, ts] of rateLimitMap) {
    if (now - ts >= RATE_LIMIT_MS) rateLimitMap.delete(email);
  }
}, 60_000);
