"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Returns a stable server/initial-client value, then flips to true once React
 * has completed hydration. This keeps layout UI that depends on browser URL
 * state from changing during the hydration comparison.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
