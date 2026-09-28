import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { AuthShell } from "./auth/-layout";
import SignUpPage from "./auth/-sign-up";

export const Route = createFileRoute("/sign-up/$")({
  component: SignUpRoute,
});

function SignUpRoute() {
  return (
    <AuthProvider>
      <AuthShell>
        <SignUpPage />
      </AuthShell>
    </AuthProvider>
  );
}
