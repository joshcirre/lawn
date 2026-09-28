"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { AuthProvider, useConvexAuthAdapter } from "@/lib/auth";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthAdapter}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export function AuthConvexProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </AuthProvider>
  );
}

export { convex };
