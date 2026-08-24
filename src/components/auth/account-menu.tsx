"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOutFromEOS } from "@/lib/auth/logout";
import { cn } from "@/lib/utils";

type AccountMenuProps = {
  displayName: string;
  role?: string;
  avatarText?: string;
  useUserIcon?: boolean;
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
};

export function AccountMenu({
  displayName,
  role,
  avatarText,
  useUserIcon = false,
  className,
  onOpenChange,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const resolvedAvatarText = avatarText ?? (displayName.trim().split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase() || "U");

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const handleLogout = async () => {
    setError(null);
    setIsLoggingOut(true);

    try {
      await signOutFromEOS();
    } catch (logoutError) {
      setIsLoggingOut(false);
      setError(logoutError instanceof Error ? logoutError.message : "Logout failed");
    }
  };

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-surface-muted"
        aria-label="Open account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          onOpenChange?.(next);
        }}
      >
        {useUserIcon ? (
          <span className="flex h-9 w-9 items-center justify-center text-primary">
            <UserRound size={28} strokeWidth={1.7} />
          </span>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8d7c9] text-xs font-bold text-[#a64d2d]">
            {resolvedAvatarText}
          </span>
        )}
        <span className="hidden sm:block">
          <span className="block text-xs font-bold leading-4">{displayName}</span>
          {role ? <span className="block text-[11px] leading-4 text-muted-foreground">{role}</span> : null}
        </span>
        <ChevronDown className="hidden text-muted-foreground sm:block" size={14} />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] min-w-48 rounded-xl border border-border bg-white p-1.5 shadow-lg"
          role="menu"
          aria-label="Account actions"
        >
          {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:cursor-wait disabled:opacity-60"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut size={16} />
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
