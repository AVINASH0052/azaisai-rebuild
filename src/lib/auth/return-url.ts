export function safeReturnUrl(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/studio/video";
  }
  return value;
}
