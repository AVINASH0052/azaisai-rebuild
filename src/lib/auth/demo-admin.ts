import { normalizeEmail } from "./password-flow";

export const DEMO_ADMIN_EMAIL = "admin@hearth.com";

export function isDemoAdminEmail(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === DEMO_ADMIN_EMAIL;
}
