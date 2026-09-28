import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";

// Force light mode variables so the homepage ignores the app's dark mode.
const lightModeVars = {
  "--background": "#f0f0e8",
  "--foreground": "#1a1a1a",
  "--shadow-color": "#1a1a1a",
  "--shadow-accent": "rgba(45,90,45,1)",
} as CSSProperties;

const STACK = [
  {
    name: "Laravel Cloud",
    role: "Hosting",
    body: "All three apps run on Laravel Cloud from one repo: the web app, the Convex backend and the auth API, with Postgres and object storage attached.",
  },
  {
    name: "Convex",
    role: "Backend",
    body: "The open-source Convex backend, self-hosted. Realtime comments, presence and uploads, with data in your own database and bucket.",
  },
  {
    name: "Laravel API",
    role: "Auth",
    body: "A small Laravel app replaces Clerk: passkeys first, email and password as a fallback, issuing JWTs that Convex verifies.",
  },
  {
    name: "TanStack Start",
    role: "Frontend",
    body: "The lawn you know: frame-accurate comments, version stacks and share links, served as a static single-page app.",
  },
];

export default function Homepage() {
  return (
    <div
      className="min-h-screen font-mono selection:bg-[#2d5a2d] selection:text-[#f0f0e8]"
      style={{ ...lightModeVars, backgroundColor: "#f0f0e8", color: "#1a1a1a" }}
    >
      <nav className="absolute top-0 z-50 flex w-full items-center justify-end px-6 py-4 text-sm font-bold tracking-wide text-[#f0f0e8] uppercase drop-shadow-md">
        <Link
          to="/sign-in"
          className="border-2 border-[#f0f0e8] px-4 py-2 transition-colors hover:bg-[#f0f0e8] hover:text-[#1a1a1a]"
        >
          Log in
        </Link>
      </nav>

      {/* Hero */}
      <section
        className="relative flex min-h-[85vh] flex-col justify-end overflow-x-clip border-b-2 border-[#1a1a1a] bg-cover bg-center bg-no-repeat px-6 pt-32 pb-32 text-[#f0f0e8] md:pb-24"
        style={{ backgroundImage: `url('/grassy-bg.avif')` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/10" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <h1
            className="ml-[-0.5vw] text-[25vw] leading-[0.75] font-black tracking-tighter sm:text-[22vw]"
            style={{ textShadow: "8px 8px 0 #1a1a1a, 0 20px 40px rgba(0,0,0,0.5)" }}
          >
            lawn
          </h1>

          <div className="mt-20 flex flex-col gap-12 md:mt-24 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-full flex-col items-start gap-4 md:gap-6">
              <div className="max-w-full origin-bottom-left -rotate-2 border-2 border-[#1a1a1a] bg-[#f0f0e8] px-5 py-3 text-[#1a1a1a] shadow-[6px_6px_0px_0px_var(--shadow-color)] md:px-8 md:py-4 md:shadow-[8px_8px_0px_0px_var(--shadow-color)]">
                <p className="text-2xl leading-tight font-black tracking-tight uppercase sm:text-3xl md:text-4xl md:leading-none">
                  Video review for creative teams.
                </p>
              </div>
              <div className="ml-2 max-w-full origin-top-left rotate-1 border-2 border-[#1a1a1a] bg-[#2d5a2d] px-5 py-3 text-[#f0f0e8] shadow-[6px_6px_0px_0px_var(--shadow-color)] md:ml-8 md:px-8 md:py-4 md:shadow-[8px_8px_0px_0px_var(--shadow-color)]">
                <p className="text-xl leading-tight font-black tracking-tight uppercase sm:text-2xl md:text-3xl md:leading-none">
                  Self-hosted. Your team, your cloud.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 pb-2 sm:flex-row lg:justify-end">
              <Link
                to="/dashboard"
                className="border-2 border-[#1a1a1a] bg-[#f0f0e8] px-8 py-5 text-center text-xl font-black text-[#1a1a1a] uppercase shadow-[6px_6px_0px_0px_var(--shadow-color)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_var(--shadow-color)] md:shadow-[8px_8px_0px_0px_var(--shadow-color)]"
              >
                Open lawn
              </Link>
              <Link
                to="/sign-up"
                className="border-2 border-[#1a1a1a] bg-[#1a1a1a] px-8 py-5 text-center text-xl font-black text-[#f0f0e8] uppercase shadow-[6px_6px_0px_0px_var(--shadow-color)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#2d5a2d] hover:shadow-[4px_4px_0px_0px_var(--shadow-color)] md:shadow-[8px_8px_0px_0px_var(--shadow-color)]"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-b-2 border-[#1a1a1a] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-4xl font-black tracking-tighter uppercase md:text-6xl">
            How this lawn runs
          </h2>
          <p className="mt-4 max-w-2xl text-[#888]">
            Same lawn, rebuilt to deploy for your own team. No plans, no seats, no billing. Anyone
            with an account can start a team and invite the rest.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STACK.map((item) => (
              <div
                key={item.name}
                className="border-2 border-[#1a1a1a] bg-[#f0f0e8] p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)]"
              >
                <p className="text-xs font-bold tracking-[0.2em] text-[#2d5a2d] uppercase">
                  {item.role}
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight">{item.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1a1a1a]/80">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credits */}
      <footer className="bg-[#1a1a1a] px-6 py-10 text-sm text-[#f0f0e8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-black">lawn.</span> Originally built by{" "}
            <a
              href="https://github.com/pingdotgg/lawn"
              className="underline underline-offset-4 hover:text-[#7cb87c]"
            >
              Theo
            </a>
            .
          </p>
          <a
            href="https://github.com/joshcirre/lawn"
            className="underline underline-offset-4 hover:text-[#7cb87c]"
          >
            Deploy your own on Laravel Cloud
          </a>
        </div>
      </footer>
    </div>
  );
}
