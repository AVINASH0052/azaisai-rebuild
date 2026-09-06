export const MIN_PASSWORD = 8;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** `null` means we could not look the address up — ask for a password, do not send them to signup. */
export function afterEmailLookup(exists: boolean | null) {
  return exists === false ? "signup" : "password";
}

export function passwordReady(password: string, confirm?: string) {
  if (password.length < MIN_PASSWORD) return "Use at least 8 characters.";
  if (confirm !== undefined && password !== confirm) return "Passwords do not match.";
  return null;
}

export function alreadyRegistered(user: { identities?: { id?: string }[] | null } | null) {
  return Boolean(user && (user.identities?.length ?? 0) === 0);
}

export function isEmailSendLimit(message: string, code?: string) {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();
  return (
    c === "over_email_send_rate_limit" ||
    m.includes("email rate limit") ||
    m.includes("over_email_send_rate_limit")
  );
}

export function friendlyPasswordError(message: string, code?: string) {
  const m = message.toLowerCase();
  const c = (code ?? "").toLowerCase();
  if (m.includes("not confirmed")) {
    return "Confirm your email first. Check your inbox for the confirmation link.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (isEmailSendLimit(message, code)) {
    return "Could not send the confirmation email yet. Wait a minute and try again.";
  }
  if (c === "over_request_rate_limit" || m.includes("rate limit")) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (m.includes("password should") || m.includes("password is")) {
    return "Password does not meet the requirements.";
  }
  return "Something went wrong. Try again.";
}

export function signupAfterResponse(opts: {
  message?: string | null;
  code?: string;
  identities?: { id?: string }[] | null;
  hasSession: boolean;
}): "sent" | "exists" | "ready" | "wait" | "error" {
  if (opts.message) {
    return isEmailSendLimit(opts.message, opts.code) ? "wait" : "error";
  }
  if (alreadyRegistered({ identities: opts.identities ?? null })) return "exists";
  if (opts.hasSession) return "ready";
  return "sent";
}

export function callbackAfterExchange(opts: {
  confirmed?: string | null;
  reset?: string | null;
  type?: string | null;
}) {
  if (opts.confirmed === "1" || opts.type === "signup") return "confirm";
  if (opts.reset === "1" || opts.type === "recovery") return "reset";
  return "session";
}

export function authHref(
  path: "/auth/login" | "/auth/signup",
  opts: { email?: string; returnUrl?: string; confirmed?: boolean } = {},
) {
  const q = new URLSearchParams();
  if (opts.email) q.set("email", opts.email);
  if (opts.returnUrl) q.set("returnUrl", opts.returnUrl);
  if (opts.confirmed) q.set("confirmed", "1");
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
