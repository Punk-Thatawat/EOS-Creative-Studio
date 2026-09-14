"use client";

import { useEffect, useState } from "react";
import { subscribeToModelCatalogChanges } from "./model-catalog-events";

export function useModelCatalogRefresh(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeToModelCatalogChanges(() => {
    setVersion((current) => current + 1);
  }), []);

  return version;
}
