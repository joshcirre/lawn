import { useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthError, safeRedirect, useAuth } from "@/lib/auth";
import { AuthButton, AuthCard, Divider, Field, FormError } from "./-fields";

export default function SignInPage() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectParam = new URLSearchParams(search).get("redirect_url");
  const redirectTo = safeRedirect(redirectParam);
  const { signInWithPasskey, signInWithPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"passkey" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function run(kind: "passkey" | "password", action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    setFieldErrors({});
    try {
      await action();
      window.location.assign(redirectTo);
    } catch (err) {
      if (err instanceof AuthError && Object.keys(err.fields).length) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't sign you in.");
      }
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run("password", () => signInWithPassword(email, password));
  }

  return (
    <AuthCard title="Sign in">
      <FormError message={error || fieldErrors.credential || fieldErrors.ceremony || null} />

      <AuthButton
        type="button"
        disabled={pending !== null}
        onClick={() => void run("passkey", signInWithPasskey)}
      >
        {pending === "passkey" ? "Waiting for passkey…" : "Sign in with passkey"}
      </AuthButton>

      <Divider />

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <AuthButton type="submit" variant="secondary" disabled={pending !== null}>
          {pending === "password" ? "Signing in…" : "Sign in with password"}
        </AuthButton>
      </form>

      <p className="mt-6 font-mono text-xs text-[#888]">
        No account?{" "}
        <a
          href={
            redirectParam
              ? `/sign-up?redirect_url=${encodeURIComponent(redirectParam)}`
              : "/sign-up"
          }
          className="font-bold text-[#2d5a2d] underline hover:text-[#1a1a1a]"
        >
          Sign up
        </a>
      </p>
    </AuthCard>
  );
}
