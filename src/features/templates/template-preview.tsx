import { useContext, useEffect, useRef, useState } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import {
  ArrowRight,
  Check,
  Copy,
  ChevronDown,
  Download,
  Heart,
  Info,
  LayoutTemplate,
  PenLine,
  Plus,
  Repeat2,
  Share2,
  Video,
  X,
} from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import Link from "next/link";
import s from "./templates-page.module.css";
import { kindKeys } from "./library-modes";
import { copy, modeOf, name, promptOf, templateHref, valid } from "./template-text";
import { LikesContext } from "./likes-context";
import { WORK_ID, WORK_TEMPLATE_EVENT, favoriteWorksKey, readFavoriteWorks } from "./saved-works";
import { inputImagesOf, variantOf } from "./use-template-images";
import { AssetThumb, ClipPreviewPlayer, Media } from "./template-media";

/** onEdit opens the template in this page's own panel; without it (or for templates that edit a clip) the editing page is linked instead. */
export function Preview({ t, close, onEdit }: { t: Template; close: () => void; onEdit?: (t: Template, addedImages?: File[]) => void }) {
  const { c, locale } = useStudioCopy();
  const maxImages = modeOf(t) === "motion" ? (variantOf(t) === "swap" ? Math.min(inputImagesOf(t).length || 4, 4) : 1) : 5;
  // Images added here join the template's own when the clip is recreated, so they need not be attached beforehand.
  const [added, setAdded] = useState<{ id: string; file: File; url: string }[]>([]);
  const addedRef = useRef(added);
  useEffect(() => {
    addedRef.current = added;
  }, [added]);
  useEffect(() => () => addedRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);
  const addInputRef = useRef<HTMLInputElement>(null);
  const addImages = (list: FileList | null) => {
    if (!list) return;
    const room = Math.max(0, maxImages - inputImagesOf(t).length - added.length);
    const picked = Array.from(list).filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type)).slice(0, room);
    setAdded([...added, ...picked.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  };
  const removeAdded = (id: string) => {
    const gone = added.find((image) => image.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setAdded(added.filter((image) => image.id !== id));
  };
  const likes = useContext(LikesContext);
  const [shared, setShared] = useState(false);
  const mine = t.id.startsWith(WORK_ID);
  const [favorite, setFavorite] = useState(() => (mine && typeof window !== "undefined" ? readFavoriteWorks().has(t.id) : false));
  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    try {
      const all = readFavoriteWorks();
      if (next) all.add(t.id);
      else all.delete(t.id);
      window.localStorage.setItem(favoriteWorksKey, JSON.stringify([...all].slice(-200)));
    } catch {
      // The mark only lasts for this window when the browser keeps nothing.
    }
  };
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current,
      overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    document.querySelectorAll<HTMLMediaElement>("video,audio").forEach((m) => m.pause());
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  const settings = t.settings ?? {};
  const inputAssets = inputImagesOf(t);
  const sourceClip = modeOf(t) === "motion" && typeof settings.sourceVideo === "string" && valid(settings.sourceVideo) ? settings.sourceVideo : undefined;
  const promptText = promptOf(t, locale);
  // Images can be added to a clip that is recreated in this page's create panel.
  const canAddImages = !!onEdit && (modeOf(t) === "create" || modeOf(t) === "motion");
  const [promptOpen, setPromptOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyPrompt = () => {
    void navigator.clipboard.writeText(promptText).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }, () => undefined);
  };
  // "bytedance/seedance-2.5/text-to-video" reads as "Seedance 2.5 Text To Video".
  const modelId = typeof settings.model === "string" ? settings.model : typeof settings.modelId === "string" ? settings.modelId : "";
  const modelLabel = modelId
    ? modelId.split("/").slice(1).join(" ").replace(/[-_]+/g, " ").replace(/(^| )([a-z])/g, (_, space: string, letter: string) => space + letter.toUpperCase())
    : "";
  const videoSrc = t.kind === "video"
    ? (valid(t.previewUrl) ? t.previewUrl : t.slug === "training-video" ? "/generated-videos/cinematic-trailer.webm" : "/generated-videos/ai-presenter.webm")
    : undefined;
  const videoFormat = typeof settings.outputFormat === "string"
    ? settings.outputFormat
    : videoSrc?.split(/[?#]/, 1)[0].split(".").pop()?.toUpperCase() || "MP4";
  const facts: [string, unknown][] = [
    [c("templates.preview.factModel"), settings.model ?? settings.modelId],
    [c("templates.preview.factRatio"), settings.ratio ?? settings.aspectRatio],
    [c("templates.preview.factResolution"), settings.resolution],
    [c("templates.preview.factCount"), settings.count],
    [
      c("templates.preview.factDuration"),
      typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined,
    ],
    [c("templates.preview.factFile"), settings.outputFormat],
  ];
  return (
    <dialog
      ref={ref}
      className={`${s.dialog} ${s.previewDialog} ${t.kind === "video" ? s.videoPreviewDialog : ""}`}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      onPlayCapture={(event) => {
        if (!(event.target instanceof HTMLVideoElement)) return;
        ref.current?.querySelectorAll("video").forEach((video) => {
          if (video !== event.target) video.pause();
        });
      }}
      aria-labelledby={t.kind === "video" ? undefined : "template-preview-title"}
      aria-label={t.kind === "video" ? c("templates.preview.clipDetails") : undefined}
    >
      <button className={s.previewClose} onClick={close} aria-label={c("templates.preview.close")}>
        <X size={20} />
      </button>
      <div className={s.previewLayout}>
        <div className={s.artworkPane}>
          {videoSrc ? (
            <ClipPreviewPlayer src={videoSrc} label={c("templates.media.videoAria", { name: name(t, locale) })} />
          ) : <Media t={t} expanded />}
          {t.kind !== "video" && <span className={s.artworkLabel}>EOS / CREATIVE STUDIO</span>}
        </div>
        <section className={`${s.previewInfo} ${t.kind === "video" ? s.videoPreviewInfo : ""}`}>
          {t.kind === "video" ? (
            <>
              <div className={s.clipScroll}>
                {sourceClip && <section className={s.clipCard}>
                  <div className={s.clipCardHead}><span><Video size={14} aria-hidden="true" />{c("templates.preview.sourceVideo")}</span></div>
                  <EosVideoPlayer key={sourceClip} className={s.clipSourceVideo} src={sourceClip} muted={false} ariaLabel={c("templates.preview.sourceVideo")} />
                </section>}
                {(promptText || inputAssets.length > 0 || canAddImages) && (
                  <section className={s.clipCard}>
                    <div className={s.clipCardHead}>
                      <span><PenLine size={14} aria-hidden="true" />{c("templates.preview.promptHeading")}</span>
                      {promptText && (
                        <button type="button" className={s.clipCopy} onClick={copyPrompt}>
                          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                          {c(copied ? "templates.preview.copied" : "templates.preview.copy")}
                        </button>
                      )}
                    </div>
                    <div className={s.clipCardBody}>
                      {(inputAssets.length > 0 || canAddImages) && (
                        <div className={s.clipAssets}>
                          {inputAssets.map((address, index) => <AssetThumb key={address} src={address} index={index + 1} />)}
                          {added.map((image, index) => (
                            <span key={image.id} className={s.clipAsset}>
                              <Image src={image.url} alt="" fill unoptimized sizes="64px" />
                              <span className={s.referenceIndex}>{inputAssets.length + index + 1}</span>
                              <button type="button" className={s.clipAssetRemove} onClick={() => removeAdded(image.id)} aria-label={c("templates.attach.remove")}>
                                <X size={11} aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                          {canAddImages && inputAssets.length + added.length < maxImages && (
                            <>
                              <button type="button" className={s.clipAssetAdd} onClick={() => addInputRef.current?.click()} aria-label={c("templates.attach.title")}>
                                <Plus size={18} aria-hidden="true" />
                              </button>
                              <input
                                ref={addInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                hidden
                                onChange={(e) => {
                                  addImages(e.target.files);
                                  e.target.value = "";
                                }}
                              />
                            </>
                          )}
                        </div>
                      )}
                      {promptText && (
                        <>
                          <p className={`${s.clipPrompt} ${promptOpen ? "" : s.clipPromptClamped}`}>{promptText}</p>
                          {promptText.length > 160 && (
                            <button type="button" className={s.clipSeeAll} onClick={() => setPromptOpen((open) => !open)} aria-expanded={promptOpen}>
                              {c(promptOpen ? "templates.preview.seeLess" : "templates.preview.seeAll")}
                              <ChevronDown size={13} aria-hidden="true" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                )}
                <section className={s.clipCard}>
                  <button type="button" className={`${s.clipCardHead} ${s.clipCardToggle}`} onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>
                    <span><Info size={14} aria-hidden="true" />{c("templates.preview.clipDetails")}</span>
                    <ChevronDown size={14} aria-hidden="true" className={detailsOpen ? s.clipChevronOpen : undefined} />
                  </button>
                  {detailsOpen && (
                    <dl className={`${s.clipDetails} ${s.clipCardBody}`}>
                      <div><dt>{c("templates.preview.clipSource")}</dt><dd>{mine ? c("templates.history.mine") : t.source === "community" ? c("templates.source.community") : c("templates.preview.clipTemplate")}</dd></div>
                      <div><dt>{c("templates.preview.clipType")}</dt><dd>{c(kindKeys.video)}</dd></div>
                      {modelLabel && <div><dt>{c("templates.preview.factModel")}</dt><dd>{modelLabel}</dd></div>}
                      {typeof settings.resolution === "string" && <div><dt>{c("templates.preview.clipQuality")}</dt><dd>{settings.resolution}</dd></div>}
                      {typeof settings.duration === "number" && <div><dt>{c("templates.preview.factDuration")}</dt><dd>{c("templates.preview.seconds", { value: settings.duration })}</dd></div>}
                      <div><dt>{c("templates.preview.clipFormat")}</dt><dd>{videoFormat}</dd></div>
                    </dl>
                  )}
                </section>
              </div>
              <div className={s.clipActions}>
                {onEdit && modeOf(t) !== "edit" ? (
                  <button type="button" className={s.clipEdit} onClick={() => onEdit(t, added.map((image) => image.file))}><Repeat2 size={16} />{c("templates.preview.recreate")}</button>
                ) : valid(t.targetPath) && t.targetPath.startsWith("/") && (
                  <Link href={templateHref(t)} className={s.clipEdit}><Repeat2 size={16} />{c("templates.preview.recreate")}</Link>
                )}
                {mine && (
                  <button
                    type="button"
                    className={s.clipSave}
                    onClick={() => {
                      close();
                      window.dispatchEvent(new CustomEvent(WORK_TEMPLATE_EVENT, { detail: t.id.slice(WORK_ID.length) }));
                    }}
                  >
                    <LayoutTemplate size={15} aria-hidden="true" />
                    {c(settings.savedAsTemplate ? "templates.save.use" : "templates.save.button")}
                  </button>
                )}
                <div className={s.clipActionGrid}>
                  {videoSrc && <a href={videoSrc} download><Download size={15} />{c("templates.preview.clipDownload")}</a>}
                  <button type="button" aria-pressed={mine ? favorite : likes.liked.has(t.slug)} aria-label={c("templates.card.like")} onClick={() => (mine ? toggleFavorite() : likes.toggle(t))}>
                    <Heart size={17} fill={(mine ? favorite : likes.liked.has(t.slug)) ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={c("templates.preview.clipShare")}
                    disabled={!videoSrc}
                    onClick={() => {
                      if (!videoSrc) return;
                      const link = new URL(videoSrc, window.location.origin).toString();
                      const done = () => {
                        setShared(true);
                        window.setTimeout(() => setShared(false), 2500);
                      };
                      // The phone's share sheet when there is one, else the link goes to the clipboard.
                      if (navigator.share) void navigator.share({ title: name(t, locale), url: link }).catch(() => undefined);
                      else void navigator.clipboard.writeText(link).then(done, () => undefined);
                    }}
                  >
                    <Share2 size={17} aria-hidden="true" />
                  </button>
                </div>
                {shared && <p className={s.clipShared} role="status">{c("templates.preview.clipShared")}</p>}
              </div>
            </>
          ) : (
            <>
              <span className={s.previewEyebrow}>{c(kindKeys[t.kind])} · TEMPLATE</span>
              <h2 id="template-preview-title">{name(t, locale)}</h2>
              <p className={s.previewDescription}>{copy(t, locale).description}</p>
              <div className={s.presetHeading}>{c("templates.preview.presetHeading")}</div>
              <dl className={s.presetFacts}>
                {facts
                  .filter(([, v]) => typeof v === "string" || typeof v === "number")
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
              {!facts.some(([, v]) => typeof v === "string" || typeof v === "number") && (
                <p className={s.previewDescription}>{c("templates.preview.noFacts")}</p>
              )}
              <div className={s.previewFooter}>
                {valid(t.targetPath) && t.targetPath.startsWith("/") && (
                  <Link href={templateHref(t)} className={s.use}>
                    {c("templates.preview.useThis")} <ArrowRight size={19} />
                  </Link>
                )}
                <p>
                  {c("templates.preview.footerLine1")}
                  <br />
                  {c("templates.preview.footerLine2")}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </dialog>
  );
}
