"use client";

import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, Check, FolderPlus, ImageIcon, ImagePlus, Loader2, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { brandKitApi, type BrandAsset, type BrandAssetKind } from "@/lib/api/brand-kit";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import { useLocale } from "@/lib/i18n/locale-provider";
import { BrandKitFolderBrowser } from "./brand-kit-folder-browser";
import { useBrandKitFolders } from "./brand-kit-folders";
import styles from "./image-attachment-picker.module.css";

const imageTypes = ["image/png", "image/jpeg", "image/webp"];
type ImageChoice = { id: string; name: string; url: string | null } & (
  { file: File; brandAsset?: never } | { file?: never; brandAsset: BrandAsset }
);

function folderImageChoices(assets: BrandAsset[]): ImageChoice[] {
  return assets.map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, brandAsset: asset }));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limit?: number;
  onPick: (files: File[], categories: Array<BrandAssetKind | undefined>) => void | Promise<void>;
};

export function ImageAttachmentPicker({ open, onOpenChange, limit = 1, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <PickerContent limit={limit} onPick={onPick} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function PickerContent({ limit, onPick, onClose }: {
  limit: number;
  onPick: Props["onPick"];
  onClose: () => void;
}) {
  const { c } = useStudioCopy();
  const { locale } = useLocale();
  const th = locale === "th";
  const input = useRef<HTMLInputElement>(null);
  const backToFolders = useRef<HTMLButtonElement>(null);
  const brandKitTab = useRef<HTMLButtonElement>(null);
  const previews = useRef(new Set<string>());
  const download = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<"uploads" | "brand-kit">("uploads");
  const [uploads, setUploads] = useState<ImageChoice[]>([]);
  const folders = useBrandKitFolders(tab === "brand-kit");
  const [folderOpened, setFolderOpened] = useState(false);
  const showFolderBrowser = tab === "brand-kit" && !folderOpened && Boolean(folders.folders?.length);
  const activeId = folderOpened ? folders.active?.id : undefined;
  const [brandImages, setBrandImages] = useState<{ id: string; images: ImageChoice[] } | null>(null);
  const [selected, setSelected] = useState<ImageChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [failedFolder, setFailedFolder] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (folderOpened) backToFolders.current?.focus();
  }, [folderOpened]);

  useEffect(() => {
    const urls = previews.current;
    return () => {
      download.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (tab !== "brand-kit" || !activeId || brandImages?.id === activeId) return;
    const controller = new AbortController();
    brandKitApi.load(activeId, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])).then((kit) => {
      if (!controller.signal.aborted) setBrandImages({ id: activeId, images: folderImageChoices(kit.assets) });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedFolder(activeId);
    });
    return () => controller.abort();
  }, [tab, activeId, brandImages, retry]);

  const remaining = Math.max(0, limit - selected.length);
  const canUpload = limit > 0 && !busy && (limit === 1 || remaining > 0);
  const loadedFolder = brandImages && brandImages.id === activeId ? brandImages : null;
  const isBrandKit = tab === "brand-kit";
  const noFolders = isBrandKit && !showFolderBrowser && folders.folders?.length === 0;
  const brandAssets = loadedFolder?.images ?? [];
  const displayed = isBrandKit ? brandAssets : uploads;
  const backLabel = th ? "กลับไปทุกโฟลเดอร์" : "Back to all folders";
  const selectedCount = Math.min(limit, selected.length);
  const countLabel = (count: number) => th ? count + " รูป" : count + (count === 1 ? " image" : " images");
  const loadFailed = folders.error || (Boolean(activeId) && failedFolder === activeId && !loadedFolder);
  const loading = tab === "brand-kit" && !loadFailed && (folders.folders === null || (Boolean(activeId) && !loadedFolder));

  const addUploads = (files: FileList) => {
    const valid = Array.from(files).filter((file) => imageTypes.includes(file.type));
    setSkipped(files.length - valid.length);
    setReadFailed(false);
    if (!canUpload) return;
    const added = valid.slice(0, limit === 1 ? 1 : remaining).map((file) => {
      const url = URL.createObjectURL(file);
      previews.current.add(url);
      return { id: url, name: file.name, url, file };
    });
    if (added.length === 0) return;
    setUploads((items) => [...items, ...added]);
    setSelected((items) => limit === 1 ? added : [...items, ...added]);
  };

  const toggle = (choice: ImageChoice) => {
    setReadFailed(false);
    setSelected((items) => {
      if (items.some((item) => item.id === choice.id)) return items.filter((item) => item.id !== choice.id);
      if (limit === 1) return [choice];
      return items.length < limit ? [...items, choice] : items;
    });
  };

  const removeUpload = (choice: ImageChoice) => {
    if (choice.url) {
      URL.revokeObjectURL(choice.url);
      previews.current.delete(choice.url);
    }
    setUploads((items) => items.filter((item) => item.id !== choice.id));
    setSelected((items) => items.filter((item) => item.id !== choice.id));
  };

  const confirm = async () => {
    setBusy(true);
    setReadFailed(false);
    const controller = new AbortController();
    download.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const choices = selected.slice(0, limit);
    try {
      const files = await Promise.all(choices.map((choice) => choice.file ?? brandKitApi.imageFile(choice.brandAsset, signal)));
      if (controller.signal.aborted) return;
      await onPick(files, choices.map((choice) => choice.brandAsset?.kind));
      if (!controller.signal.aborted) onClose();
    } catch {
      if (!controller.signal.aborted) setReadFailed(true);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <DialogContent className={styles.dialog} data-brand-kit={isBrandKit || undefined} data-empty={noFolders || undefined} data-folder-open={isBrandKit && folderOpened || undefined} overlayClassName={styles.overlay} showCloseButton={false}>
      <DialogTitle className="sr-only">{c("templates.picker.title")}</DialogTitle>
      <Tabs.Root className={styles.tabs} value={tab} onValueChange={(value) => setTab(value === "brand-kit" ? "brand-kit" : "uploads")}>
        <header className={styles.header}>
          <Tabs.List className={styles.tabList} aria-label={c("templates.picker.title")}>
            <Tabs.Tab value="uploads" disabled={busy}>{c("templates.picker.uploads")}</Tabs.Tab>
            <Tabs.Tab ref={brandKitTab} value="brand-kit" disabled={busy}>Brand Kit</Tabs.Tab>
          </Tabs.List>
          <div className={styles.headerActions}>
            {isBrandKit && activeId && <button ref={backToFolders} type="button" className={styles.close}
              aria-label={backLabel} title={backLabel} disabled={busy} onClick={() => {
                setFolderOpened(false);
                brandKitTab.current?.focus();
              }}>
              <ArrowLeft size={19} aria-hidden="true" />
            </button>}
            <DialogClose className={styles.close} aria-label={c("templates.picker.close")}>
              <X size={19} aria-hidden="true" />
            </DialogClose>
          </div>
        </header>
        <Tabs.Panel className={showFolderBrowser ? styles.folderPanel : styles.panel} value={tab}>
          {showFolderBrowser && folders.folders ? (
            <BrandKitFolderBrowser folders={folders.folders}
              onOpen={(folderId) => { folders.select(folderId); setFolderOpened(true); }}
              onSave={folders.save} />
          ) : <>
            {noFolders && <section className={styles.emptyKit} aria-labelledby="empty-brand-kit-title">
              <Image src="/brand-kit/hero-folder.webp" alt="" width={920} height={518} unoptimized />
              <h2 id="empty-brand-kit-title">{th ? "ยังไม่มี Brand Kit" : "No Brand Kit yet"}</h2>
              <p>{th
                ? "สร้าง Brand Kit แรกของคุณเพื่อเก็บโลโก้ สีแบรนด์ และรูปสินค้า ให้พร้อมใช้งานในทุกโปรเจกต์"
                : "Create your first Brand Kit to keep logos, brand colors, and product images ready for every project."}</p>
              <Link className={styles.confirm} href="/brand-kit?create=1" onNavigate={onClose}>
                <FolderPlus size={20} aria-hidden="true" />
                {th ? "สร้าง" : "Create"}
              </Link>
            </section>}
            {!noFolders && <div className={styles.grid} data-brand-assets={isBrandKit || undefined}>
              {tab === "uploads" && <>
                <input ref={input} type="file" accept={imageTypes.join(",")} multiple={limit > 1} hidden onChange={(event) => {
                  if (event.currentTarget.files) addUploads(event.currentTarget.files);
                  event.currentTarget.value = "";
                }} />
                <button type="button" className={styles.upload} disabled={!canUpload} onClick={() => input.current?.click()}>
                  <ImagePlus size={27} aria-hidden="true" /> {c("templates.picker.upload")}
                </button>
              </>}
              {displayed.map((choice) => {
                const active = selected.some((item) => item.id === choice.id);
                return (
                  <div className={styles.cell} key={choice.id}>
                    <button type="button" className={styles.image} data-kind={choice.brandAsset?.kind} aria-pressed={active} aria-label={choice.name} title={choice.name}
                      disabled={busy || (!active && remaining === 0 && limit !== 1)} onClick={() => toggle(choice)}>
                      <span className={styles.thumbnail}>
                        {choice.url && <Image src={choice.url} alt="" fill unoptimized sizes="176px" onError={(event) => { event.currentTarget.hidden = true; }} />}
                        {isBrandKit && <ImageIcon className={styles.fallbackIcon} size={24} aria-hidden="true" />}
                      </span>
                      <span className={styles.name}>{choice.name}</span>
                      {isBrandKit && <span className={styles.fileType}>WebP</span>}
                      {(isBrandKit || active) && <span className={styles.check} aria-hidden="true">{active && <Check size={14} />}</span>}
                    </button>
                    {choice.file && <button type="button" className={styles.remove} disabled={busy}
                      aria-label={`${c("templates.picker.removeDiscard")} ${choice.name}`} onClick={() => removeUpload(choice)}>
                      <X size={14} aria-hidden="true" />
                    </button>}
                  </div>
                );
              })}
            </div>}
            {loading && <p className={styles.notice} role="status">{c("templates.picker.loading")}</p>}
            {tab === "brand-kit" && loadFailed && <p className={styles.notice} role="alert">
              {c("templates.picker.failed")}{" "}
              <button type="button" className={styles.retry} onClick={() => {
                if (folders.error) folders.retry();
                else { setFailedFolder(null); setRetry((count) => count + 1); }
              }}>{c("templates.picker.retry")}</button>
            </p>}
            {!noFolders && !loading && !(isBrandKit && loadFailed) && displayed.length === 0 && (
              <p className={styles.notice}>
                {!isBrandKit ? c("templates.picker.empty") : (th ? "โฟลเดอร์นี้ยังไม่มีรูป" : "This folder has no images yet.")}
              </p>
            )}
          </>}
        </Tabs.Panel>
      </Tabs.Root>
      {!noFolders && !showFolderBrowser && <footer className={styles.footer}>
        <div aria-live="polite">
          {isBrandKit ? <div className={styles.counts}>
            <ImageIcon size={19} aria-hidden="true" />
            <strong>{th ? "เลือกแล้ว " + countLabel(selectedCount) : countLabel(selectedCount) + " selected"}</strong>
            {loadedFolder && <span>{th ? "ทั้งหมด " + countLabel(brandAssets.length) : countLabel(brandAssets.length) + " total"}</span>}
          </div> : <div>{c("templates.picker.left", { count: remaining })}</div>}
          {skipped > 0 && <div className={styles.error}>{c("templates.picker.skipped", { count: skipped })}</div>}
          {readFailed && <div className={styles.error}>{c("templates.picker.attachFailed")}</div>}
        </div>
        <div className={styles.actions}>
          {isBrandKit && <DialogClose className={styles.cancel}>{th ? "ยกเลิก" : "Cancel"}</DialogClose>}
          <button type="button" className={styles.confirm} disabled={selectedCount === 0 || busy} onClick={() => void confirm()}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : isBrandKit && <Plus size={20} aria-hidden="true" />}
            {c("templates.picker.add", { count: selectedCount })}
          </button>
        </div>
      </footer>}
    </DialogContent>
  );
}
