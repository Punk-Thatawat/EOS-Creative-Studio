"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Menu } from "@base-ui/react/menu";
import { Folder, FolderPlus, LayoutGrid, List, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { BrandKitFolder } from "@/lib/api/brand-kit";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./image-attachment-picker.module.css";

export function BrandKitFolderBrowser({ folders, onOpen, onSave, onRemove, startCreating = false, page = false }: {
  folders: BrandKitFolder[];
  onOpen: (folderId: string) => void;
  onSave: (name: string, folderId?: string) => Promise<void>;
  onRemove?: (folderId: string) => Promise<void>;
  startCreating?: boolean;
  page?: boolean;
}) {
  const { locale } = useLocale();
  const th = locale === "th";
  const searchInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const cancelRemove = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editor, setEditor] = useState<{ folderId?: string } | null>(() => startCreating ? {} : null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [pendingFolder, setPendingFolder] = useState<BrandKitFolder | null>(null);
  const search = query.trim().toLocaleLowerCase(locale);
  const displayed = folders.filter((folder) => folder.name.toLocaleLowerCase(locale).includes(search));
  const folderCount = th ? "ทั้งหมด " + folders.length + " โฟลเดอร์" : folders.length + (folders.length === 1 ? " folder" : " folders");

  useEffect(() => {
    if (editor) nameInput.current?.focus();
  }, [editor]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving || !name.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      await onSave(name.trim(), editor.folderId);
      if (!editor.folderId) setQuery("");
      setEditor(null);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onRemove || !pendingFolder || saving) return;
    const folder = pendingFolder;
    setSaving(true);
    setRemoveError("");
    try {
      await onRemove(folder.id);
      if (editor?.folderId === folder.id) setEditor(null);
    } catch (error) {
      setRemoveError(error instanceof Error && error.message === "brand_folder_delete_incomplete"
        ? (th ? "ลบรูปได้บางส่วน กรุณาลองลบโฟลเดอร์อีกครั้ง" : "Some images could not be removed. Try deleting the folder again.")
        : (th ? "ลบโฟลเดอร์ไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not delete the folder. Try again."));
    } finally {
      setSaving(false);
      setPendingFolder(null);
    }
  }

  return (
    <div className={styles.folderBrowser} data-page={page || undefined}>
      {(folders.length > 0 || !editor) && <div className={styles.folderToolbar}>
        <label className={styles.search}>
          <Search size={20} aria-hidden="true" />
          <input ref={searchInput} type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)}
            aria-label={th ? "ค้นหาโฟลเดอร์" : "Search folders"}
            placeholder={th ? "ค้นหาโฟลเดอร์..." : "Search folders..."} />
        </label>
        <div className={styles.viewToggle} role="group" aria-label={th ? "รูปแบบการแสดงผล" : "View options"}>
          <button type="button" aria-label={th ? "มุมมองตาราง" : "Grid view"} aria-pressed={view === "grid"} onClick={() => setView("grid")}>
            <LayoutGrid size={19} aria-hidden="true" />
          </button>
          <button type="button" aria-label={th ? "มุมมองรายการ" : "List view"} aria-pressed={view === "list"} onClick={() => setView("list")}>
            <List size={20} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={styles.confirm} disabled={saving} onClick={() => {
          setName("");
          setFailed(false);
          setEditor({});
        }}>
          <FolderPlus size={20} aria-hidden="true" />
          {page ? (th ? "สร้างโฟลเดอร์" : "Create folder") : (th ? "สร้าง" : "Create")}
        </button>
      </div>}

      {removeError && <p className={styles.error} role="alert">{removeError}</p>}
      {editor && <form className={styles.folderEditor} onSubmit={(event) => void save(event)}>
        <label className={styles.search}>
          <span className="sr-only">{th ? "ชื่อโฟลเดอร์" : "Folder name"}</span>
          <input ref={nameInput} value={name} placeholder={th ? "ชื่อโฟลเดอร์" : "Folder name"} onChange={(event) => setName(event.currentTarget.value)}
            maxLength={80} disabled={saving} required />
        </label>
        <button className={styles.confirm} disabled={saving || !name.trim()}>{editor.folderId ? (th ? "บันทึกชื่อ" : "Save name") : page ? (th ? "สร้าง" : "Create") : (th ? "สร้างโฟลเดอร์" : "Create folder")}</button>
        <button type="button" className={styles.cancel} disabled={saving} onClick={() => {
          setEditor(null);
          searchInput.current?.focus();
        }}>{th ? "ยกเลิก" : "Cancel"}</button>
        {failed && <p className={styles.error} role="alert">{th ? "บันทึกโฟลเดอร์ไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not save the folder. Try again."}</p>}
      </form>}

      {folders.length === 0 && !editor && <p className={styles.folderEmpty} role="status">
        {th ? "ยังไม่มีโฟลเดอร์ สร้างโฟลเดอร์เพื่อเริ่มอัปโหลดรูป" : "Create your first folder to start uploading images."}
      </p>}
      {folders.length > 0 && <>
        <div className={styles.folderResults}>
          {!displayed.length && <p className={styles.notice} role="status">{th ? "ไม่พบโฟลเดอร์ที่ตรงกับคำค้น" : "No folders match your search."}</p>}
          <ul className={styles.folderCards} data-list={view === "list" || undefined}>
            {displayed.map((folder) => (
              <li className={styles.folderCard} key={folder.id}>
                <button type="button" className={styles.openFolder} disabled={saving} onClick={() => onOpen(folder.id)}>
                  <Folder className={styles.folderIcon} aria-hidden="true" />
                  <strong>{folder.name}</strong>
                  {folder.imageCount !== undefined && <span>{th
                    ? folder.imageCount + " รูป"
                    : folder.imageCount + (folder.imageCount === 1 ? " image" : " images")}</span>}
                </button>
                <Menu.Root>
                  <Menu.Trigger className={styles.folderMore} disabled={saving}
                    aria-label={th ? "ตัวเลือกของ " + folder.name : "Options for " + folder.name}>
                    <MoreHorizontal size={21} aria-hidden="true" />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner className={styles.folderMenuPosition} sideOffset={4} align="end">
                      <Menu.Popup className={styles.folderMenu}>
                        <Menu.Item onClick={() => {
                          setName(folder.name);
                          setFailed(false);
                          setEditor({ folderId: folder.id });
                        }}><Pencil size={15} aria-hidden="true" /> {th ? "เปลี่ยนชื่อ" : "Rename"}</Menu.Item>
                        {onRemove && <Menu.Item className={styles.error} onClick={() => { setRemoveError(""); setPendingFolder(folder); }}>
                          <Trash2 size={15} aria-hidden="true" /> {th ? "ลบโฟลเดอร์" : "Delete folder"}
                        </Menu.Item>}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </li>
            ))}
          </ul>
        </div>

        <footer className={styles.folderFooter}>
          <span><Folder size={20} aria-hidden="true" />{folderCount}</span>
        </footer>
      </>}
      <AlertDialog.Root open={pendingFolder !== null} onOpenChange={(open) => {
        if (!open && !saving) setPendingFolder(null);
      }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className={styles.folderDeleteBackdrop} />
          <AlertDialog.Popup className={styles.folderDeleteDialog} initialFocus={cancelRemove} finalFocus={searchInput}>
            <AlertDialog.Title>{th ? "ลบโฟลเดอร์นี้หรือไม่?" : "Delete this folder?"}</AlertDialog.Title>
            <AlertDialog.Description>
              {th ? 'รูปและสีแบรนด์ใน “' + pendingFolder?.name + '” จะถูกลบและกู้คืนไม่ได้'
                : 'All images and brand colors in “' + pendingFolder?.name + '” will be permanently deleted.'}
            </AlertDialog.Description>
            <div className={styles.folderDeleteActions}>
              <AlertDialog.Close render={<Button ref={cancelRemove} type="button" variant="outline" disabled={saving} />}>
                {th ? "ยกเลิก" : "Cancel"}
              </AlertDialog.Close>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
                {saving ? (th ? "กำลังลบ…" : "Deleting…") : (th ? "ลบโฟลเดอร์" : "Delete folder")}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
