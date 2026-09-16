"use client";

import { useEffect, useState } from "react";
import { subscribeToModelCatalogChanges } from "./model-catalog-events";
import { clearGenerationModelCache } from "./api/generation-models";

export function useModelCatalogRefresh(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => subscribeToModelCatalogChanges(() => {
    clearGenerationModelCache();
    setVersion((current) => current + 1);
  }), []);

  return version;
}
