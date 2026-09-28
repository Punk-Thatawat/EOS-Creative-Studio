"use client";

import { Settings2 } from "lucide-react";

export function CookieSettingsButton({ label = "Cookie settings", className = "" }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 ${className}`}
      onClick={() => window.dispatchEvent(new Event("eos:open-cookie-settings"))}
    >
      <Settings2 size={13} />
      {label}
    </button>
  );
}
