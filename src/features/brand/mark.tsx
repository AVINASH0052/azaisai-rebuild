export function HearthMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#e06b24" />
      <path
        fill="#fff8f1"
        d="M16 5.5c-3.6 7.2-5.6 10.8-5.6 14.8C10.4 24.1 12.9 27 16 27s5.6-2.9 5.6-6.7c0-4-2-7.6-5.6-14.8z"
      />
      <path
        fill="#c4531c"
        d="M16 13c-1.8 3.8-2.2 4.9-2.2 6.4 0 1.4 1 2.4 2.2 2.4s2.2-1 2.2-2.4c0-1.5-.4-2.6-2.2-6.4z"
      />
    </svg>
  );
}
