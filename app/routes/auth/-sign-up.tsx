import { useRouterState } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthError, safeRedirect, useAuth } from "@/lib/auth";
import { AuthButton, AuthCard, Field, FormError } from "./-fields";

export default function SignUpPage() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const redirectParam = new URLSearchParams(search).get("redirect_url");
  const redirectTo = safeRedirect(redirectParam);
  const { signUpWithPasskey, signUpWithPassword } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      if (usePassword) await signUpWithPassword(name, email, password);
      else await signUpWithPasskey(name, email);
      window.location.assign(redirectTo);
    } catch (err) {
      if (err instanceof AuthError && Object.keys(err.fields).length) {
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't create your account.");
      }
      setPending(false);
    }
  }

  return (
    <AuthCard title="Create account">
      <FormError message={error || fieldErrors.credential || fieldErrors.ceremony || null} />

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        {usePassword && (
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
        )}

        <AuthButton type="submit" disabled={pending}>
          {pending
            ? usePassword
              ? "Creating account…"
              : "Waiting for passkey…"
            : usePassword
              ? "Create account"
              : "Create account with passkey"}
        </AuthButton>
      </form>

      <button
        type="button"
        onClick={() => {
          setUsePassword((value) => !value);
          setFieldErrors({});
          setError(null);
        }}
        className="mt-4 font-mono text-xs font-bold text-[#1a1a1a] underline hover:text-[#2d5a2d]"
      >
        {usePassword ? "Use a passkey instead" : "Use a password instead"}
      </button>

      {!usePassword && (
        <p className="mt-2 font-mono text-xs text-[#888]">
          A passkey signs you in with Face ID, Touch ID, or your device PIN. No password to
          remember.
        </p>
      )}

      <p className="mt-6 font-mono text-xs text-[#888]">
        Already have an account?{" "}
        <a
          href={
            redirectParam
              ? `/sign-in?redirect_url=${encodeURIComponent(redirectParam)}`
              : "/sign-in"
          }
          className="font-bold text-[#2d5a2d] underline hover:text-[#1a1a1a]"
        >
          Sign in
        </a>
      </p>
    </AuthCard>
  );
}
