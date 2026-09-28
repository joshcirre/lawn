import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { AuthShell } from "./auth/-layout";
import SignInPage from "./auth/-sign-in";

export const Route = createFileRoute("/sign-in/$")({
  component: SignInRoute,
});

function SignInRoute() {
  return (
    <AuthProvider>
      <AuthShell>
        <SignInPage />
      </AuthShell>
    </AuthProvider>
  );
}
