"use client";

import { useCallback, useEffect, useState } from "react";
import { brandKitApi, type BrandKitFolder } from "@/lib/api/brand-kit";

export function useBrandKitFolders(enabled = true) {
  const [folders, setFolders] = useState<BrandKitFolder[] | null>(null);
  const [selectedId, select] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled || folders !== null) return;
    const controller = new AbortController();
    void brandKitApi.folders(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((data) => { if (!controller.signal.aborted) setFolders(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [enabled, folders, retryKey]);

  async function save(name: string, id?: string) {
    const folder = id ? await brandKitApi.renameFolder(id, name) : await brandKitApi.createFolder(name);
    setFolders((items) => id
      ? (items ?? []).map((item) => item.id === id ? { ...item, ...folder } : item)
      : [...(items ?? []), { imageCount: 0, ...folder }]);
    select(folder.id);
  }

  async function remove(id: string) {
    try {
      await brandKitApi.removeFolder(id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "brand_kit_folder_not_found") {
        if (error instanceof Error && error.message === "brand_folder_delete_incomplete") {
          const updated = await brandKitApi.folders(AbortSignal.timeout(10000)).catch(() => null);
          if (updated) setFolders(updated);
        }
        throw error;
      }
    }
    setFolders((items) => items?.filter((folder) => folder.id !== id) ?? null);
    select((current) => current === id ? null : current);
  }

  const updateImageCount = useCallback((id: string, imageCount: number) => {
    setFolders((items) => items?.map((folder) => (
      folder.id === id && folder.imageCount !== imageCount ? { ...folder, imageCount } : folder
    )) ?? null);
  }, []);

  return {
    folders,
    active: folders?.find((folder) => folder.id === selectedId) ?? folders?.[0],
    error,
    select,
    save,
    remove,
    updateImageCount,
    retry() { setError(false); setRetryKey((key) => key + 1); },
  };
}
