"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  ImageIcon,
  LoaderCircle,
  Package,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandKitApi, type BrandAssetKind, type BrandKit } from "@/lib/api/brand-kit";
import { useLocale } from "@/lib/i18n/locale-provider";
import { BrandKitFolderControls, useBrandKitFolders } from "./brand-kit-folders";
import s from "./brand-kit-page.module.css";

const copy = {
  th: {
    intro: "เก็บเอกลักษณ์ของแบรนด์ไว้ในที่เดียว",
    description: "จัดเก็บโลโก้ สีแบรนด์ และรูปสินค้า ให้พร้อมหยิบไปใช้กับงานครั้งต่อไป",
    storage: "พื้นที่ Brand Kit",
    quota: "{mb} MB รวมต่อบัญชี · นับจากไฟล์หลังย่อภาพ",
    overQuota: "พื้นที่ที่ใช้อยู่เกินโควตาปัจจุบัน รูปเดิมยังอยู่ครบ กรุณาลบรูปที่ไม่ใช้ก่อนอัปโหลดเพิ่ม",
    left: "เหลือ",
    refresh: "โหลดใหม่",
    loading: "กำลังโหลด Brand Kit…",
    retry: "ลองอีกครั้ง",
    logos: "โลโก้",
    logoHint: "เก็บโลโก้พื้นโปร่งใสหรือเวอร์ชันสีต่าง ๆ ได้สูงสุด 5 รูปต่อโฟลเดอร์",
    products: "รูปสินค้า",
    productHint: "รวมภาพสินค้าและมุมต่าง ๆ ตั้งชื่อให้ค้นเจอได้ง่าย",
    uploadLogo: "เพิ่มโลโก้",
    uploadProduct: "เพิ่มรูปสินค้า",
    imageHint: "JPG, PNG, WebP · ไม่เกิน 10 MB ต่อไฟล์ · ระบบย่อภาพอัตโนมัติ",
    emptyLogo: "เพิ่มโลโก้แรกของแบรนด์",
    emptyProduct: "เพิ่มรูปสินค้าของคุณ",
    emptyHint: "เลือกไฟล์จากเครื่องเพื่อเริ่มต้น",
    uploading: "กำลังอัปโหลด",
    colors: "สีแบรนด์",
    colorHint: "บันทึกได้สูงสุด 10 สี แล้วคัดลอกรหัสสีไปใช้กับงาน",
    addColor: "เพิ่มสี",
    save: "บันทึกสี",
    saved: "บันทึกเรียบร้อยแล้ว",
    removeColor: "ลบสี",
    pickColor: "เลือกสี",
    colorCode: "รหัสสี",
    colorInvalid: "กรอกรหัสสีรูปแบบ #RRGGBB ให้ครบและไม่ซ้ำกัน",
    noColors: "ยังไม่มีสีแบรนด์ เริ่มเพิ่มสีหลักของคุณได้เลย",
    copied: "คัดลอกรหัสสีแล้ว",
    copy: "คัดลอกรหัสสี",
    rename: "เปลี่ยนชื่อ",
    name: "ชื่อรูป",
    saveName: "บันทึกชื่อ",
    cancel: "ยกเลิก",
    remove: "ลบรูป",
    deletePrompt: "ลบรูปนี้ออกจาก Brand Kit? พื้นที่จะคืนหลังลบสำเร็จ",
    deleted: "ลบรูปแล้ว",
    preview: "โหลดภาพไม่ได้ ลองกดโหลดใหม่",
    uploadingDone: "อัปโหลดเรียบร้อยแล้ว",
    readOnly: "กำลังทำรายการ กรุณารอสักครู่",
    errors: {
      brand_file_required: "กรุณาเลือกไฟล์ภาพ",
      brand_file_too_large: "ไฟล์ต้องมีขนาดไม่เกิน 10 MB",
      "File too large": "ไฟล์ต้องมีขนาดไม่เกิน 10 MB",
      brand_invalid_image: "รองรับภาพ JPG, PNG และ WebP แบบภาพนิ่งเท่านั้น",
      brand_image_too_complex: "ภาพมีรายละเอียดมากเกินไป กรุณาลดขนาดแล้วลองใหม่",
      brand_quota_exceeded: "พื้นที่ Brand Kit เต็มแล้ว กรุณาลบรูปที่ไม่ใช้ก่อนอัปโหลด",
      brand_asset_limit: "เก็บโลโก้ได้สูงสุด 5 รูปต่อโฟลเดอร์ และรูปทั้งหมดไม่เกิน 100 รูปต่อบัญชี",
      brand_invalid_colors: "กรุณาตรวจรหัสสีอีกครั้ง",
      brand_asset_not_found: "ไม่พบรูปนี้ กรุณาโหลดข้อมูลใหม่",
      brand_storage_unavailable: "พื้นที่จัดเก็บยังไม่พร้อมใช้งาน",
      brand_session_expired: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
    } as Record<string, string>,
    generic: "ทำรายการไม่สำเร็จ กรุณาลองใหม่ หากเพิ่งอัปโหลด ให้โหลดข้อมูลใหม่ก่อนลองซ้ำ",
    nameRequired: "กรุณากรอกชื่อรูป (1–80 ตัวอักษร)",
  },
  en: {
    intro: "Your brand essentials, together",
    description: "Keep logos, brand colors, and product photos ready for your next creation.",
    storage: "Brand Kit storage",
    quota: "{mb} MB per account · measured after image optimization",
    overQuota:
      "Your usage exceeds the current quota. Existing images are kept. Delete unused images before uploading more.",
    left: "available",
    refresh: "Refresh",
    loading: "Loading your Brand Kit…",
    retry: "Try again",
    logos: "Logos",
    logoHint: "Keep up to 5 transparent logos or color variations per folder.",
    products: "Product photos",
    productHint: "Keep product shots and different angles with names you can recognize.",
    uploadLogo: "Add logo",
    uploadProduct: "Add product photos",
    imageHint: "JPG, PNG, WebP · up to 10 MB per file · automatically optimized",
    emptyLogo: "Add your first logo",
    emptyProduct: "Add your product photos",
    emptyHint: "Choose images from your device to get started",
    uploading: "Uploading",
    colors: "Brand colors",
    colorHint: "Save up to 10 colors and copy their codes into your work.",
    addColor: "Add color",
    save: "Save colors",
    saved: "Saved",
    removeColor: "Remove color",
    pickColor: "Choose color",
    colorCode: "Color code",
    colorInvalid: "Use complete, unique #RRGGBB color codes.",
    noColors: "No brand colors yet. Add your primary color to get started.",
    copied: "Color code copied",
    copy: "Copy color code",
    rename: "Rename",
    name: "Image name",
    saveName: "Save name",
    cancel: "Cancel",
    remove: "Delete image",
    deletePrompt: "Delete this image from your Brand Kit? Storage is released after deletion.",
    deleted: "Image deleted",
    preview: "Preview unavailable. Try refreshing.",
    uploadingDone: "Upload complete",
    readOnly: "An action is in progress. Please wait.",
    errors: {
      brand_file_required: "Choose an image first.",
      brand_file_too_large: "Each file must be 10 MB or smaller.",
      "File too large": "Each file must be 10 MB or smaller.",
      brand_invalid_image: "Only static JPG, PNG, and WebP images are supported.",
      brand_image_too_complex: "This image is too complex. Resize it and try again.",
      brand_quota_exceeded: "Your Brand Kit storage is full. Delete unused images first.",
      brand_asset_limit: "You can keep up to 5 logos per folder and 100 images per account.",
      brand_invalid_colors: "Check your color codes.",
      brand_asset_not_found: "This image was not found. Refresh your kit.",
      brand_storage_unavailable: "Image storage is currently unavailable.",
      brand_session_expired: "Your session expired. Sign in again.",
    } as Record<string, string>,
    generic: "Something went wrong. Try again. If you just uploaded, refresh before retrying.",
    nameRequired: "Enter an image name (1–80 characters).",
  },
};

function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);

export function BrandKitPage({ initialFolderId }: { initialFolderId?: string }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const state = useBrandKitFolders(true, initialFolderId);
  const [busy, setBusy] = useState(false);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>YOUR CREATIVE IDENTITY</span>
          <h1>Brand Kit</h1>
          <h2>{t.intro}</h2>
          <p>{t.description}</p>
        </div>
      </header>
      <BrandKitFolderControls state={state} disabled={busy} />
      {state.error && <div className={s.error} role="alert">
        {t.generic}{" "}
        <Button type="button" variant="outline" size="sm" onClick={state.retry}>{t.retry}</Button>
      </div>}
      {state.folders === null && !state.error && <div className={s.loading} role="status">{t.loading}</div>}
      {state.folders?.length === 0 && <p>
        {locale === "th" ? "สร้างโฟลเดอร์แรกเพื่อเก็บโลโก้ สีแบรนด์ และรูปสินค้า" : "Create your first folder to store logos, colors, and product images."}
      </p>}
      {state.active && <BrandKitFolderPage key={state.active.id} folderId={state.active.id} busy={busy} setBusy={setBusy} />}
    </div>
  );
}

function BrandKitFolderPage({ folderId, busy, setBusy }: { folderId: string; busy: boolean; setBusy: (busy: boolean) => void }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const actionLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const productInput = useRef<HTMLInputElement>(null);
  const message = (cause: unknown) => t.errors[cause instanceof Error ? cause.message : ""] ?? t.generic;

  useEffect(() => {
    const controller = new AbortController();
    void brandKitApi
      .load(folderId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setKit(value);
          setColors(value.colors);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "brand_request_failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [folderId]);

  async function action(work: () => Promise<BrandKit>, success: string) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const value = await work();
      setKit(value);
      setNotice(success);
      return value;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "brand_request_failed");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function refresh() {
    const value = await action(() => brandKitApi.load(folderId), "");
    if (value) setColors(value.colors);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, kind: BrandAssetKind) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || actionLock.current) return;
    const invalid = files.find((file) => !accepted.has(file.type) || file.size > 10 * 1024 * 1024);
    if (invalid) {
      setError(invalid.size > 10 * 1024 * 1024 ? "brand_file_too_large" : "brand_invalid_image");
      return;
    }
    actionLock.current = true;
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`${i + 1}/${files.length}`);
        setKit(await brandKitApi.upload(folderId, kind, files[i]));
      }
      setNotice(t.uploadingDone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "brand_request_failed");
      // An interrupted response may still have saved the image. Reload before allowing another attempt.
      try {
        setKit(await brandKitApi.load(folderId));
      } catch {
        /* Keep the last confirmed snapshot and show the error. */
      }
    } finally {
      actionLock.current = false;
      setBusy(false);
      setUploadProgress("");
    }
  }

  const validColors =
    colors.every((color) => /^#[0-9A-Fa-f]{6}$/.test(color)) &&
    new Set(colors.map((color) => color.toUpperCase())).size === colors.length;
  const dirty = JSON.stringify(colors.map((color) => color.toUpperCase())) !== JSON.stringify(kit?.colors ?? []);
  const percent = kit ? Math.min(100, (kit.usedBytes / kit.quotaBytes) * 100) : 0;

  function assets(kind: BrandAssetKind) {
    const items = kit?.assets.filter((asset) => asset.kind === kind) ?? [];
    const logo = kind === "logo";
    return (
      <section className={s.card} aria-labelledby={`${kind}-heading`}>
        <div className={s.sectionHead}>
          <div>
            <h2 id={`${kind}-heading`}>
              {logo ? <ImageIcon size={19} /> : <Package size={19} />}
              {logo ? t.logos : t.products}
              <span className={s.count}>
                {items.length}
                {logo ? "/5" : ""}
              </span>
            </h2>
            <p>{logo ? t.logoHint : t.productHint}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy || (logo && items.length >= 5) || (kit?.remainingBytes ?? 0) <= 0}
            onClick={() => (logo ? logoInput : productInput).current?.click()}
          >
            <Plus size={16} />
            {logo ? t.uploadLogo : t.uploadProduct}
          </Button>
        </div>
        <input
          ref={logo ? logoInput : productInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            void upload(event, kind);
          }}
          disabled={busy}
        />
        {!items.length ? (
          <button
            type="button"
            className={s.empty}
            disabled={busy}
            onClick={() => (logo ? logoInput : productInput).current?.click()}
          >
            <span className={s.emptyIcon}>{logo ? <ImageIcon size={27} /> : <Package size={27} />}</span>
            <strong>{logo ? t.emptyLogo : t.emptyProduct}</strong>
            <span>{t.emptyHint}</span>
            <span className={s.uploadLabel}>
              <Upload size={15} />
              {logo ? t.uploadLogo : t.uploadProduct}
            </span>
          </button>
        ) : (
          <div className={s.assetGrid}>
            {items.map((asset) => (
              <article key={asset.id} className={s.asset}>
                <div className={`${s.preview} ${logo ? s.logoPreview : ""}`}>
                  {asset.url ? (
                    <Image
                      key={asset.url}
                      src={asset.url}
                      alt={asset.name}
                      width={asset.width}
                      height={asset.height}
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.hidden = false;
                      }}
                    />
                  ) : null}
                  <span className={s.previewFallback} hidden={Boolean(asset.url)}>
                    <ImageIcon size={25} />
                    <span>{t.preview}</span>
                  </span>
                </div>
                <div className={s.assetInfo}>
                  {editingId === asset.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!name.trim()) return;
                        void action(() => brandKitApi.rename(asset.id, name.trim()), t.saved).then((value) => {
                          if (value) setEditingId(null);
                        });
                      }}
                    >
                      <label className={s.srOnly} htmlFor={`name-${asset.id}`}>
                        {t.name}
                      </label>
                      <input
                        autoFocus
                        id={`name-${asset.id}`}
                        value={name}
                        maxLength={80}
                        required
                        onChange={(event) => setName(event.target.value)}
                        disabled={busy}
                      />
                      <div className={s.editActions}>
                        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
                          {t.saveName}
                        </Button>
                        <button type="button" disabled={busy} onClick={() => setEditingId(null)}>
                          {t.cancel}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <strong title={asset.name}>{asset.name}</strong>
                      <span>
                        {asset.width} × {asset.height} · {size(asset.sizeBytes)}
                      </span>
                      <div className={s.assetActions}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(asset.id);
                            setName(asset.name);
                          }}
                          aria-label={`${t.rename}: ${asset.name}`}
                        >
                          <Pencil size={14} />
                          {t.rename}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(t.deletePrompt))
                              void action(() => brandKitApi.remove(asset.id), t.deleted);
                          }}
                          aria-label={`${t.remove}: ${asset.name}`}
                        >
                          <Trash2 size={14} />
                          {t.remove}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className={s.fileHint}>{t.imageHint}</p>
      </section>
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void refresh();
          }}
          disabled={busy || loading}
        >
          <RefreshCw size={16} />
          {t.refresh}
        </Button>
      </div>
      <div aria-live="polite" aria-atomic="true" className={!notice && !busy ? s.fileInput : undefined}>
        {notice ? (
          <p className={s.notice}>
            <Check size={17} />
            {notice}
          </p>
        ) : null}
        {busy ? (
          <p className={s.pending}>
            <LoaderCircle size={17} className="animate-spin" />
            {uploadProgress ? `${t.uploading} ${uploadProgress}` : t.readOnly}
          </p>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className={s.error}>
          {message(new Error(error))}
          {!kit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void refresh();
              }}
            >
              {t.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className={s.loading} role="status">
          <LoaderCircle className="animate-spin" />
          {t.loading}
        </div>
      ) : kit ? (
        <>
          <section className={s.storage} aria-label={t.storage}>
            <div>
              <span className={s.storageIcon}>
                <Palette size={23} />
              </span>
              <div>
                <h2>{t.storage}</h2>
                <p>{t.quota.replace("{mb}", String(kit.quotaBytes / 1024 / 1024))}</p>
              </div>
            </div>
            <div className={s.storageNumbers}>
              <strong>
                {size(kit.usedBytes)} <span>/ {size(kit.quotaBytes)}</span>
              </strong>
              <p>
                {size(kit.remainingBytes)} {t.left}
              </p>
            </div>
            <div
              className={s.meter}
              role="progressbar"
              aria-label={t.storage}
              aria-valuenow={Math.round(percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${size(kit.usedBytes)} / ${size(kit.quotaBytes)}`}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
          </section>
          {kit.usedBytes > kit.quotaBytes ? (
            <p role="status" className={s.validation}>
              {t.overQuota}
            </p>
          ) : null}
          {assets("logo")}
          <section className={s.card} aria-labelledby="brand-colors-heading">
            <div className={s.sectionHead}>
              <div>
                <h2 id="brand-colors-heading">
                  <Palette size={19} />
                  {t.colors}
                  <span className={s.count}>{colors.length}/10</span>
                </h2>
                <p>{t.colorHint}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy || colors.length >= 10}
                onClick={() => {
                  const defaults = [
                    "#F26B38",
                    "#171412",
                    "#FFFFFF",
                    "#F4E9DD",
                    "#254F42",
                    "#F7C65B",
                    "#784A91",
                    "#3C73AF",
                    "#DB647B",
                    "#727272",
                  ];
                  setColors([...colors, defaults.find((color) => !colors.includes(color)) ?? "#000000"]);
                }}
              >
                <Plus size={16} />
                {t.addColor}
              </Button>
            </div>
            {colors.length ? (
              <div className={s.colorGrid}>
                {colors.map((color, i) => (
                  <div key={i} className={s.colorCard}>
                    <label
                      className={s.colorPicker}
                      style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#eeeeee" }}
                    >
                      <span className={s.srOnly}>
                        {t.pickColor} {i + 1}
                      </span>
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#000000"}
                        disabled={busy}
                        onChange={(event) =>
                          setColors(
                            colors.map((value, index) => (index === i ? event.target.value.toUpperCase() : value)),
                          )
                        }
                      />
                    </label>
                    <label className={s.srOnly} htmlFor={`color-${i}`}>
                      {t.colorCode} {i + 1}
                    </label>
                    <input
                      id={`color-${i}`}
                      className={s.colorCode}
                      value={color}
                      maxLength={7}
                      disabled={busy}
                      spellCheck={false}
                      onChange={(event) =>
                        setColors(
                          colors.map((value, index) => (index === i ? event.target.value.toUpperCase() : value)),
                        )
                      }
                      aria-invalid={!/^#[0-9A-Fa-f]{6}$/.test(color)}
                    />
                    <div className={s.colorActions}>
                      <button
                        type="button"
                        aria-label={`${t.copy} ${color}`}
                        disabled={busy || !/^#[0-9A-Fa-f]{6}$/.test(color)}
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(color)
                            .then(() => setNotice(t.copied))
                            .catch(() => setError("brand_request_failed"));
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${t.removeColor} ${i + 1}`}
                        disabled={busy}
                        onClick={() => setColors(colors.filter((_, index) => index !== i))}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={s.colorEmpty}>{t.noColors}</p>
            )}
            {!validColors ? (
              <p className={s.validation} role="alert">
                {t.colorInvalid}
              </p>
            ) : null}
            <div className={s.colorFooter}>
              <Button
                type="button"
                disabled={busy || !validColors || !dirty}
                onClick={() => {
                  void action(() => brandKitApi.colors(folderId, colors), t.saved).then((value) => {
                    if (value) setColors(value.colors);
                  });
                }}
              >
                <Check size={16} />
                {t.save}
              </Button>
            </div>
          </section>
          {assets("product")}
        </>
      ) : null}
    </>
  );
}
