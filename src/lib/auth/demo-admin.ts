import { normalizeEmail } from "./password-flow";

export const DEMO_ADMIN_EMAIL = "admin@azaisai.test";

export function isDemoAdminEmail(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === DEMO_ADMIN_EMAIL;
}
