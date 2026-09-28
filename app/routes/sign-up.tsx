import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { seoHead } from "@/lib/seo";
import { AuthShell } from "./auth/-layout";
import SignUpPage from "./auth/-sign-up";

export const Route = createFileRoute("/sign-up")({
  head: () =>
    seoHead({
      title: "Create account",
      description: "Create your lawn account.",
      path: "/sign-up",
      noIndex: true,
    }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_url: typeof search.redirect_url === "string" ? search.redirect_url : undefined,
  }),
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
