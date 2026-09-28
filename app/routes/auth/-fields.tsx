import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-2 border-[#1a1a1a] bg-[#f0f0e8] p-6 shadow-[8px_8px_0px_0px_var(--shadow-color)] sm:p-8">
      <h1 className="mb-6 font-mono text-2xl font-black tracking-tighter text-[#1a1a1a] uppercase">
        {title}
      </h1>
      {children}
    </div>
  );
}

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs font-bold text-[#1a1a1a] uppercase">
        {label}
      </span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className="w-full border-2 border-[#1a1a1a] bg-transparent px-3 py-2 font-mono text-[#1a1a1a] transition-shadow outline-none focus:border-[#2d5a2d] focus:shadow-[4px_4px_0px_0px_var(--shadow-accent)]"
      />
      {error && <span className="mt-1 block font-mono text-xs text-[#b42318]">{error}</span>}
    </label>
  );
}

export function AuthButton({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      {...props}
      className={cn(
        "w-full border-2 border-[#1a1a1a] px-4 py-3 font-mono text-sm font-bold uppercase transition-all disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-[#1a1a1a] text-[#f0f0e8] shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#2d5a2d] hover:shadow-[2px_2px_0px_0px_var(--shadow-color)]"
          : "bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-[#f0f0e8]",
        className,
      )}
    />
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-[2px] flex-1 bg-[#1a1a1a]" />
      <span className="font-mono text-xs font-bold text-[#888]">OR</span>
      <span className="h-[2px] flex-1 bg-[#1a1a1a]" />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 border-2 border-[#b42318] px-3 py-2 font-mono text-xs text-[#b42318]"
    >
      {message}
    </p>
  );
}
