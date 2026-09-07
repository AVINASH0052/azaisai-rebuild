import { DEMO_ADMIN_EMAIL, isDemoAdminEmail } from "./demo-admin";

/** Demo password used when AUTH_ADMIN_PASSWORD is unset. */
export const DEMO_ADMIN_PASSWORD_DEFAULT = "hearth-admin";

export function demoAdminPassword() {
  const fromEnv = process.env.AUTH_ADMIN_PASSWORD?.trim();
  return fromEnv && fromEnv.length >= 8 ? fromEnv : DEMO_ADMIN_PASSWORD_DEFAULT;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function adminPasswordMatches(password: string) {
  return safeEqual(password, demoAdminPassword());
}

export { DEMO_ADMIN_EMAIL, isDemoAdminEmail };
