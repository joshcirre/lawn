import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthError, useAuth } from "@/lib/auth";

// Replaces Clerk's <UserButton>: identity, add a passkey, sign out.
export function UserMenu() {
  const { user, addPasskey, signOut } = useAuth();
  const [status, setStatus] = useState<string | null>(null);

  if (!user) return null;

  const initials =
    user.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  async function handleAddPasskey() {
    setStatus(null);
    try {
      await addPasskey();
      setStatus("Passkey added.");
    } catch (error) {
      setStatus(error instanceof AuthError ? error.message : "Couldn't add a passkey.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center border-2 border-[#1a1a1a] bg-[#1a1a1a] font-mono text-xs font-bold text-[#f0f0e8] transition-colors hover:bg-[#2d5a2d]"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-bold text-[#1a1a1a]">{user.name}</p>
          <p className="truncate font-mono text-xs text-[#888]">{user.email}</p>
          <p className="mt-1 font-mono text-xs text-[#888]">
            {user.passkeyCount === 1 ? "1 passkey" : `${user.passkeyCount} passkeys`}
            {user.hasPassword ? " · password" : ""}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleAddPasskey();
          }}
        >
          Add a passkey
        </DropdownMenuItem>
        {status && (
          <p className="px-2 pb-1 font-mono text-xs text-[#2d5a2d]" role="status">
            {status}
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
