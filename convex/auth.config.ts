import type { AuthConfig } from "convex/server";

// Tokens come from the Laravel auth API (auth-api/). AUTH_ISSUER_URL is its
// public URL; it must match the JWT `iss` claim (JWT_ISSUER / APP_URL there).
const issuer = process.env.AUTH_ISSUER_URL?.replace(/\/$/, "");

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: issuer!,
      jwks: `${issuer}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
