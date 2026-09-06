export function SignOutButton() {
  return (
    <form action="/api/auth/sign-out" method="POST">
      <button type="submit" className="text-sm text-fg-subtle hover:text-fg">
        Sign out
      </button>
    </form>
  );
}
