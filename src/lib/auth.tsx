"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Client for the Laravel auth API (auth-api/). It issues short-lived RS256
// access tokens that Convex verifies (convex/auth.config.ts) plus a rotating
// refresh token kept in localStorage.

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  hasPassword: boolean;
  passkeyCount: number;
};

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

type AuthState =
  | { status: "loading"; user: null }
  | { status: "signedOut"; user: null }
  | { status: "signedIn"; user: AuthUser };

type AuthContextValue = AuthState & {
  isLoaded: boolean;
  isSignedIn: boolean;
  fetchAccessToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithPasskey: () => Promise<void>;
  signUpWithPassword: (name: string, email: string, password: string) => Promise<void>;
  signUpWithPasskey: (name: string, email: string) => Promise<void>;
  addPasskey: () => Promise<void>;
  signOut: (redirectTo?: string) => Promise<void>;
};

const REFRESH_TOKEN_KEY = "lawn.auth.refreshToken";
const REFRESH_LOCK = "lawn.auth.refresh";
// Refresh a bit before expiry so in-flight Convex requests never carry a stale token.
const EXPIRY_SKEW_MS = 60_000;

const authUrl = (import.meta.env.VITE_AUTH_URL ?? "").replace(/\/$/, "");

export class AuthError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
    readonly status = 0,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  if (!authUrl) {
    throw new AuthError("Missing VITE_AUTH_URL");
  }
  const { token, ...rest } = init;
  const response = await fetch(`${authUrl}/api${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = (body.errors ?? {}) as Record<string, string[]>;
    const fields = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0] ?? ""]));
    throw new AuthError(
      Object.values(fields)[0] || body.message || "Something went wrong.",
      fields,
      response.status,
    );
  }
  return body as T;
}

function readRefreshToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

function writeRefreshToken(token: string | null) {
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Serialize refreshes across tabs: rotating the same refresh token twice looks
// like token theft to the server and revokes the session.
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK, fn);
  }
  return fn();
}

function assertPasskeySupport() {
  if (
    typeof PublicKeyCredential === "undefined" ||
    typeof PublicKeyCredential.parseCreationOptionsFromJSON !== "function"
  ) {
    throw new AuthError("This browser doesn't support passkeys. Use a password instead.");
  }
}

async function createPasskeyCredential(options: PublicKeyCredentialCreationOptionsJSON) {
  assertPasskeySupport();
  const credential = await navigator.credentials.create({
    publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
  });
  if (!credential) throw new AuthError("Passkey creation was cancelled.");
  return (credential as PublicKeyCredential).toJSON();
}

async function getPasskeyCredential(options: PublicKeyCredentialRequestOptionsJSON) {
  assertPasskeySupport();
  const credential = await navigator.credentials.get({
    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
  });
  if (!credential) throw new AuthError("Passkey sign-in was cancelled.");
  return (credential as PublicKeyCredential).toJSON();
}

function passkeyErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return new AuthError("Passkey request was cancelled or timed out.");
  }
  if (error instanceof DOMException && error.name === "InvalidStateError") {
    return new AuthError("This device already has a passkey for your account.");
  }
  return error;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });
  const access = useRef<{ token: string; expiresAt: number } | null>(null);

  const accept = useCallback((tokens: TokenResponse) => {
    writeRefreshToken(tokens.refreshToken);
    access.current = {
      token: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    setState({ status: "signedIn", user: tokens.user });
  }, []);

  const clear = useCallback(() => {
    writeRefreshToken(null);
    access.current = null;
    setState({ status: "signedOut", user: null });
  }, []);

  const refresh = useCallback(
    () =>
      withRefreshLock(async () => {
        // Read inside the lock: another tab may have just rotated it.
        const refreshToken = readRefreshToken();
        if (!refreshToken) {
          clear();
          return null;
        }
        try {
          const tokens = await api<TokenResponse>("/token/refresh", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          accept(tokens);
          return tokens.accessToken;
        } catch (error) {
          // Only a rejected token ends the session. On network or server
          // errors keep the stored token so a later attempt can recover.
          if (error instanceof AuthError && error.status === 401) clear();
          else if (!access.current) setState({ status: "signedOut", user: null });
          return null;
        }
      }),
    [accept, clear],
  );

  const inflight = useRef<Promise<string | null> | null>(null);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const current = access.current;
      if (!forceRefreshToken && current && current.expiresAt - EXPIRY_SKEW_MS > Date.now()) {
        return current.token;
      }
      inflight.current ??= refresh().finally(() => {
        inflight.current = null;
      });
      return inflight.current;
    },
    [refresh],
  );

  useEffect(() => {
    if (readRefreshToken()) void fetchAccessToken({ forceRefreshToken: true });
    else setState({ status: "signedOut", user: null });

    // Mirror sign-in/out from other tabs.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== REFRESH_TOKEN_KEY) return;
      if (!event.newValue) {
        access.current = null;
        setState({ status: "signedOut", user: null });
      } else if (!access.current) {
        void fetchAccessToken({ forceRefreshToken: true });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fetchAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isLoaded: state.status !== "loading",
      isSignedIn: state.status === "signedIn",
      fetchAccessToken,
      async signInWithPassword(email, password) {
        accept(
          await api<TokenResponse>("/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          }),
        );
      },
      async signUpWithPassword(name, email, password) {
        accept(
          await api<TokenResponse>("/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
          }),
        );
      },
      async signInWithPasskey() {
        const { ceremony, options } = await api<{
          ceremony: string;
          options: PublicKeyCredentialRequestOptionsJSON;
        }>("/passkeys/login/options", { method: "POST" });
        try {
          const credential = await getPasskeyCredential(options);
          accept(
            await api<TokenResponse>("/passkeys/login", {
              method: "POST",
              body: JSON.stringify({ ceremony, credential }),
            }),
          );
        } catch (error) {
          throw passkeyErrorMessage(error);
        }
      },
      async signUpWithPasskey(name, email) {
        const { ceremony, options } = await api<{
          ceremony: string;
          options: PublicKeyCredentialCreationOptionsJSON;
        }>("/passkeys/register/options", {
          method: "POST",
          body: JSON.stringify({ name, email }),
        });
        try {
          const credential = await createPasskeyCredential(options);
          accept(
            await api<TokenResponse>("/passkeys/register", {
              method: "POST",
              body: JSON.stringify({ ceremony, credential }),
            }),
          );
        } catch (error) {
          throw passkeyErrorMessage(error);
        }
      },
      async addPasskey() {
        const token = await fetchAccessToken({ forceRefreshToken: false });
        if (!token) throw new AuthError("Your session expired. Sign in again.");
        const { ceremony, options } = await api<{
          ceremony: string;
          options: PublicKeyCredentialCreationOptionsJSON;
        }>("/passkeys/options", { method: "POST", token });
        try {
          const credential = await createPasskeyCredential(options);
          const { user } = await api<{ user: AuthUser }>("/passkeys", {
            method: "POST",
            token,
            body: JSON.stringify({ ceremony, credential }),
          });
          setState({ status: "signedIn", user });
        } catch (error) {
          throw passkeyErrorMessage(error);
        }
      },
      async signOut(redirectTo = "/") {
        const refreshToken = readRefreshToken();
        // Clear credentials and leave without flipping React state first:
        // otherwise auth-guarded pages race us to /sign-in.
        writeRefreshToken(null);
        access.current = null;
        if (refreshToken) {
          await api("/logout", {
            method: "POST",
            keepalive: true,
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(() => {});
        }
        window.location.assign(redirectTo);
      },
    }),
    [state, fetchAccessToken, accept, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

// Shape expected by ConvexProviderWithAuth. fetchAccessToken is stable, so
// Convex doesn't reconnect on every render.
export function useConvexAuthAdapter() {
  const { status, fetchAccessToken } = useAuth();
  return useMemo(
    () => ({
      isLoading: status === "loading",
      isAuthenticated: status === "signedIn",
      fetchAccessToken,
    }),
    [status, fetchAccessToken],
  );
}

// Only allow same-origin relative redirects after sign-in.
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard") {
  return target && target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}
