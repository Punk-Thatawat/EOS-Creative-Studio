"use client";

import { FolderPlus, Pencil } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { brandKitApi, type BrandKitFolder } from "@/lib/api/brand-kit";
import { useLocale } from "@/lib/i18n/locale-provider";

export function useBrandKitFolders(enabled = true, initialFolderId?: string) {
  const [folders, setFolders] = useState<BrandKitFolder[] | null>(null);
  const [selectedId, select] = useState<string | null>(initialFolderId ?? null);
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
      ? (items ?? []).map((item) => item.id === id ? folder : item)
      : [...(items ?? []), folder]);
    select(folder.id);
  }

  return {
    folders,
    active: folders?.find((folder) => folder.id === selectedId) ?? folders?.[0],
    error,
    select,
    save,
    retry() { setError(false); setRetryKey((key) => key + 1); },
  };
}

export function BrandKitFolderControls({ state, disabled = false }: {
  state: ReturnType<typeof useBrandKitFolders>;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const th = locale === "th";
  const [editing, setEditing] = useState<"create" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const locked = disabled || saving;

  function start(mode: "create" | "rename") {
    setEditing(mode);
    setName(mode === "rename" ? state.active?.name ?? "" : "");
    setFailed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || !editing || !name.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      await state.save(name.trim(), editing === "rename" ? state.active?.id : undefined);
      setEditing(null);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (state.folders === null) return null;
  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {state.active && <>
          <select className="max-w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            aria-label={th ? "โฟลเดอร์ Brand Kit" : "Brand Kit folder"}
            value={state.active.id} disabled={locked}
            onChange={(event) => { state.select(event.currentTarget.value); setEditing(null); }}>
            {state.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <Button variant="outline" type="button" size="sm" disabled={locked} onClick={() => start("rename")}>
            <Pencil aria-hidden="true" /> {th ? "เปลี่ยนชื่อ" : "Rename"}
          </Button>
        </>}
        <Button variant="outline" type="button" size="sm" disabled={locked} onClick={() => start("create")}>
          <FolderPlus aria-hidden="true" /> {th ? "สร้าง Brand Kit" : "Create Brand Kit"}
        </Button>
      </div>
      {editing && <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void submit(event)}>
        <label className="text-sm font-medium">
          <span className="sr-only">{th ? "ชื่อโฟลเดอร์" : "Folder name"}</span>
          <input className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-foreground"
            value={name} onChange={(event) => setName(event.currentTarget.value)} maxLength={80}
            placeholder={th ? "ชื่อโฟลเดอร์" : "Folder name"} disabled={locked} required />
        </label>
        <Button type="submit" size="sm" disabled={locked || !name.trim()}>
          {editing === "create" ? (th ? "สร้าง" : "Create") : (th ? "บันทึกชื่อ" : "Save name")}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => setEditing(null)}>
          {th ? "ยกเลิก" : "Cancel"}
        </Button>
        {failed && <p role="alert" className="text-sm text-destructive">
          {th ? "บันทึกโฟลเดอร์ไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not save the folder. Try again."}
        </p>}
      </form>}
    </div>
  );
}
