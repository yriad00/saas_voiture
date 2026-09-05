"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-white">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{name}</p>
        <p className="truncate text-xs text-sidebar-foreground">{subtitle}</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sign out"
          className="rounded-md p-1.5 text-sidebar-foreground hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}
