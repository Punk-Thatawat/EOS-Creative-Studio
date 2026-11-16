"use client";

import { type RefObject, useEffect } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function visibleFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden",
  );
}

/**
 * Keyboard behaviour a modal dialog needs: move focus into it when it opens,
 * keep Tab / Shift+Tab inside it, and give focus back to whatever had it before.
 * `preferred` is a selector for the control to focus first (defaults to the first focusable one).
 */
export function useDialogFocus(open: boolean, containerRef: RefObject<HTMLElement | null>, preferred?: string) {
  useEffect(() => {
    if (!open) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = (preferred ? container.querySelector<HTMLElement>(preferred) : null) ?? visibleFocusable(container)[0];
    initial?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = visibleFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, containerRef, preferred]);
}
