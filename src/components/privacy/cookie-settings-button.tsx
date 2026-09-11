"use client";

import { Settings2 } from "lucide-react";

export function CookieSettingsButton() {
  return <button type="button" className="inline-flex items-center gap-1.5" onClick={() => window.dispatchEvent(new Event("eos:open-cookie-settings"))}>
    <Settings2 size={13} />
    Cookie settings
  </button>;
}
