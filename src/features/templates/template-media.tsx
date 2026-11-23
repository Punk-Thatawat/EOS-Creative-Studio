import { useContext, useEffect, useRef, useState } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { AudioLines, Copy, Expand, Heart } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import { kindKeys } from "./library-modes";
import { name, ratioOf, valid } from "./template-text";
import { LikesContext } from "./likes-context";

export function Media({ t, expanded = false, tile = false }: { t: Template; expanded?: boolean; tile?: boolean }) {
  const { c, locale } = useStudioCopy();
  const ref = useRef<HTMLMediaElement | null>(null),
    [failed, setFailed] = useState(false),
    [imageError, setImageError] = useState(false);
  const playable = valid(t.previewUrl) && !failed;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== el) el.pause();
    };
    const claim = () => {
      if (!el.muted && !el.paused) window.dispatchEvent(new CustomEvent("template-audio", { detail: el }));
    };
    const hidden = () => {
      if (document.hidden) el.pause();
    };
    window.addEventListener("template-audio", other);
    el.addEventListener("play", claim);
    el.addEventListener("volumechange", claim);
    document.addEventListener("visibilitychange", hidden);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) el.pause();
          else if (t.kind === "video" && !expanded && !reduced && el.muted && !document.hidden)
            void el.play().catch(() => {});
        });
      },
      { threshold: 0.55 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
      window.removeEventListener("template-audio", other);
      el.removeEventListener("play", claim);
      el.removeEventListener("volumechange", claim);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [t.previewUrl, t.kind, expanded, playable]);
  const poster =
    imageError || !valid(t.thumbnailUrl) ? (
      <span className={s.missing}>{tile ? name(t, locale) : c("templates.media.coverFailed")}</span>
    ) : (
      <Image
        src={t.thumbnailUrl}
        alt={expanded ? name(t, locale) : ""}
        fill
        unoptimized
        sizes="(max-width:700px) 100vw, 65vw"
        className={s.poster}
        onError={() => setImageError(true)}
      />
    );
  if (t.kind === "video" && playable)
    return (
      <video
        ref={(el) => {
          ref.current = el;
        }}
        src={t.previewUrl}
        poster={t.thumbnailUrl}
        className={s.video}
        controls={!tile}
        muted={!expanded}
        loop={!expanded}
        playsInline
        preload="metadata"
        aria-label={c("templates.media.videoAria", { name: name(t, locale) })}
        onError={() => setFailed(true)}
      />
    );
  // A gallery tile only shows the cover; the sample itself is played in the preview.
  if (t.kind === "audio" && tile)
    return (
      <div className={s.still}>
        {poster}
        <span className={s.audioMark}>
          <AudioLines size={22} />
        </span>
      </div>
    );
  if (t.kind === "audio")
    return (
      <div className={s.audio}>
        <div className={s.audioCover}>{poster}</div>
        <div className={s.audioPlayer}>
          <AudioLines size={36} />
          <strong>{name(t, locale)}</strong>
          {playable ? (
            <audio
              ref={(el) => {
                ref.current = el;
              }}
              src={t.previewUrl}
              controls
              preload="metadata"
              aria-label={c("templates.media.audioAria", { name: name(t, locale) })}
              onError={() => setFailed(true)}
            />
          ) : (
            <span>{failed ? c("templates.media.audioFailed") : c("templates.media.audioMissing")}</span>
          )}
        </div>
      </div>
    );
  return (
    <div className={s.still}>
      {poster}
      {t.kind === "video" && (
        <span className={s.noPreview}>
          {failed ? c("templates.media.videoFailed") : c("templates.media.videoMissing")}
        </span>
      )}
    </div>
  );
}

export function ClipPreviewPlayer({ src, label }: { src: string; label: string }) {
  const [ratio, setRatio] = useState("16 / 9");
  return (
    <div className={s.clipPlayer} style={{ "--clip-ratio": ratio } as React.CSSProperties}>
      <EosVideoPlayer src={src} muted={false} className={s.clipEos} onAspectRatioChange={setRatio} ariaLabel={label} />
    </div>
  );
}

export function Tile({
  t,
  selected,
  onSelect,
  onExpand,
  onRecreate,
}: {
  t: Template;
  selected: boolean;
  onSelect: (t: Template) => void;
  onExpand: (t: Template) => void;
  /** What the Recreate button does when it is not the same as picking the tile (product templates ask for the product first). */
  onRecreate?: (t: Template) => void;
}) {
  const { c, locale } = useStudioCopy();
  const likes = useContext(LikesContext);
  const liked = likes.liked.has(t.slug);
  const likeCount = likes.counts[t.slug] ?? t.likeCount ?? 0;
  return (
    <article className={`${s.tile} ${selected ? s.tileSelected : ""}`} style={{ aspectRatio: String(ratioOf(t)) }}>
      <Media t={t} tile key={t.id + t.previewUrl} />
      <button type="button" className={s.tileOpen} aria-pressed={selected} onClick={() => onSelect(t)} aria-label={name(t, locale)} />
      <span className={s.kind}>{c(kindKeys[t.kind])}</span>
      {t.source === "community" && t.authorName && <span className={s.tileAuthor}>{t.authorName}</span>}
      <button
        type="button"
        className={s.tileExpand}
        onClick={() => onExpand(t)}
        aria-label={c("templates.card.previewAria", { name: name(t, locale) })}
      >
        <Expand size={15} />
      </button>
      <div className={s.tileActions}>
        <button type="button" className={s.tileLike} aria-pressed={liked} aria-label={c("templates.card.like")} onClick={() => likes.toggle(t)}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
          {likeCount > 0 ? likeCount : null}
        </button>
        <button type="button" className={s.tileRecreate} onClick={() => (onRecreate ?? onSelect)(t)}>
          <Copy size={14} aria-hidden="true" />
          {c("templates.card.recreate")}
        </button>
      </div>
    </article>
  );
}

/** One input image of a template in its details; one that no longer loads (an expired link) is left out. */
export function AssetThumb({ src, index }: { src: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span className={s.clipAsset}>
      <Image src={src} alt="" fill unoptimized sizes="64px" onError={() => setFailed(true)} />
      <span className={s.referenceIndex}>{index}</span>
    </span>
  );
}
