"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";

export default function AuthStatusButton() {
  const { loading, signOutUser, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMounted(true), 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!mounted || loading) {
    return null;
  }

  if (!user) {
    return (
      <div className="fixed left-4 top-4 z-[1200] flex gap-2">
        <Link
          className="rounded-full border-2 border-[#24110c]/15 bg-[#fff4cf] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#24110c] shadow-[0_7px_0_rgba(36,17,12,0.12)]"
          href="/sign-in"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed left-4 top-4 z-[1200]">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border-2 border-[#24110c]/15 bg-[#fff4cf] p-1.5 pl-3 text-[#24110c] shadow-[0_7px_0_rgba(36,17,12,0.12)] transition-transform hover:-translate-y-0.5"
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
        type="button"
      >
        <UserRound className="h-4 w-4 text-[#8f1110]" />
        <span className="max-w-40 truncate text-xs font-black uppercase tracking-[0.12em]">
          {user.displayName || user.email || "Signed in"}
        </span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#8f1110] text-[#fff4cf]">
          <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {menuOpen ? (
        <div
          className="absolute left-0 mt-3 w-56 overflow-hidden rounded-[1.25rem] border-2 border-[#24110c]/15 bg-[#fff4cf] p-2 text-[#24110c] shadow-[0_18px_44px_rgba(36,17,12,0.2)]"
          role="menu"
        >
          <Link
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.14em] transition-colors hover:bg-[#f8edcf]"
            href="/profile"
            onClick={() => setMenuOpen(false)}
            role="menuitem"
          >
            <UserRound className="h-4 w-4 text-[#8f1110]" />
            Profile page
          </Link>
          <button
            className="mt-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black uppercase tracking-[0.14em] text-[#8f1110] transition-colors hover:bg-[#f8edcf]"
            onClick={() => {
              setMenuOpen(false);
              void signOutUser();
            }}
            role="menuitem"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
