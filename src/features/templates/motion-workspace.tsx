import { useEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { ChevronDown, ImagePlus, Plus, Sparkles, Video, User, X } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { referenceCategoryCopyKeys } from "./template-references";
import {
  createMotionTransferGeneration,
  createVideoSwapGeneration,
} from "@/lib/api/motion-transfer-generations";
import { uploadImageAsset } from "@/lib/api/storage";
import { ImageAttachmentPicker } from "@/features/brand-kit/image-attachment-picker";
import { MotionVideoPicker, rememberVideoUpload } from "./media-picker";
import { formatGenerationError } from "@/lib/api/generation-errors";
import {
  emitGenerationRequestFailed,
  emitGenerationStarted,
  emitGenerationSubmitting,
} from "@/lib/generation-progress-events";
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import {
  inputImagesOf,
  referenceVideoOf,
  useTemplateImages,
  variantOf,
} from "./use-template-images";
import { creditText, useCreditQuote, useModelPicker } from "./use-template-quote";

export function MotionWorkspace({ t, onClear, incoming }: { t?: Template; onClear?: () => void; incoming?: { key: number; templateId: string; files: File[] } | null }) {
  const { c, locale } = useStudioCopy();
  // "Motion transfer" moves the clip's motion onto a character; "Objects swap" puts what the images show in place of a person,
  // an object or the background of the clip. A template opens in the tool it was made with.
  const [variant, setVariant] = useState<"motion" | "swap">(variantOf(t));
  const [seen, setSeen] = useState(t?.id);
  if (seen !== t?.id) {
    setSeen(t?.id);
    setVariant(variantOf(t));
  }
  const swapping = variant === "swap";
  const configuredImages = swapping && t ? inputImagesOf(t).length : 0;
  const fixedImageSlots = swapping && configuredImages > 0;
  const imageLimit = swapping ? Math.min(configuredImages || 4, 4) : 1;
  const { images, attach, detach, replace, error: attachError, loading: imagesLoading } = useTemplateImages(t, imageLimit, true, fixedImageSlots);
  const handledIncoming = useRef<number | null>(null);
  useEffect(() => {
    if (!incoming || incoming.templateId !== t?.id || handledIncoming.current === incoming.key) return;
    handledIncoming.current = incoming.key;
    attach(incoming.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each batch is transferred once
  }, [incoming, t?.id]);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  // Where the background comes from (scene control), and which source the character's orientation follows.
  // A motion video of the visitor's own (3-30 seconds); it takes the place of the template's clip.
  const [ownMotion, setOwnMotion] = useState<{ file: File; url: string } | null>(null);
  const motionInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (ownMotion) URL.revokeObjectURL(ownMotion.url); }, [ownMotion]);
  // The pickers: media already uploaded, saved, generated or liked, instead of a new upload.
  const [motionPickerOpen, setMotionPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [sceneControl, setSceneControl] = useState(true);
  const [sceneSource, setSceneSource] = useState<"video" | "image">("video");
  const [orientation, setOrientation] = useState<"video" | "image">("video");
  // What was picked in each tool; until something is picked, the model, quality and swap target of the template stand.
  const [picked, setPicked] = useState<Record<"motion" | "swap", { quality: string; swapMode: string; duration: number }>>({
    motion: { quality: "", swapMode: "", duration: 0 },
    swap: { quality: "", swapMode: "", duration: 0 },
  });
  const motionPicker = useModelPicker("motion-transfer");
  const swapPicker = useModelPicker("video-swap");
  const picker = swapping ? swapPicker : motionPicker;
  const mine = picked[variant];
  const own = t && variantOf(t) === variant ? (t.settings ?? {}) : {};
  const templateModel = typeof own.model === "string" && picker.options.some((option) => option.id === own.model) ? own.model : "";
  const h3Template = own.model === "minimax/h3-lite/reference-to-video" || own.model === "wavespeed-ai/minimax-h3/reference-to-video";
  // Never silently substitute a more expensive model for an H3 Lite trial template.
  const model = h3Template ? templateModel : picker.preferredModel || templateModel || picker.defaultModel;
  const isH3Open = swapping && model === "wavespeed-ai/minimax-h3/reference-to-video";
  const isH3Reference = isH3Open || (swapping && model === "minimax/h3-lite/reference-to-video");
  const qualityChoices = picker.qualitiesOf(model).length ? picker.qualitiesOf(model) : ["720p", "1080p"];
  const ownQuality = [own.quality, own.resolution].find((value): value is string => typeof value === "string");
  const quality = mine.quality && qualityChoices.includes(mine.quality) ? mine.quality : (ownQuality && qualityChoices.includes(ownQuality) ? ownQuality : isH3Reference ? "480p" : "");
  const duration = isH3Reference ? picker.durationFor(model, mine.duration || (typeof own.duration === "number" ? own.duration : 6)) : undefined;
  const aspectRatio = isH3Reference ? (typeof own.aspectRatio === "string" ? own.aspectRatio : "9:16") : undefined;
  const swapModes = swapping ? picker.modesOf(model) : [];
  const swapMode = mine.swapMode || (typeof own.swapMode === "string" && swapModes.includes(own.swapMode) ? own.swapMode : (swapModes[0] ?? ""));
  const pick = (patch: Partial<typeof mine>) => setPicked({ ...picked, [variant]: { ...mine, ...patch } });
  /** The group chip the picker was on when "upload from device" was pressed. */
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const reference = referenceVideoOf(t);
  const motionSrc = ownMotion?.url ?? reference;
  const [preparedVideo, setPreparedVideo] = useState<{ source: string; url?: string; failed?: boolean } | null>(null);
  const [videoRetry, setVideoRetry] = useState(0);
  useEffect(() => {
    if (!swapping || !model || !motionSrc) return;
    let alive = true;
    const prepare = async () => {
      try {
        let url = motionSrc;
        if (ownMotion) {
          url = await uploadImageAsset(ownMotion.file, { purpose: "content", feature: "motion-transfer" });
        } else if (!/^https?:\/\//i.test(url)) {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Cannot load source video");
          const blob = await response.blob();
          url = await uploadImageAsset(new File([blob], `${t?.slug ?? "motion"}.${blob.type.includes("webm") ? "webm" : "mp4"}`, { type: blob.type || "video/mp4" }), { purpose: "content", feature: "motion-transfer" });
        }
        if (alive) setPreparedVideo({ source: motionSrc, url });
      } catch {
        if (alive) setPreparedVideo({ source: motionSrc, failed: true });
      }
    };
    void prepare();
    return () => { alive = false; };
  }, [swapping, model, motionSrc, ownMotion, t?.slug, videoRetry]);
  const readyVideo = swapping && preparedVideo && preparedVideo.source === motionSrc ? preparedVideo.url : undefined;
  const videoPrepareFailed = swapping && preparedVideo && preparedVideo.source === motionSrc && preparedVideo.failed;
  const [quoteRetry, setQuoteRetry] = useState(0);
  const credits = useCreditQuote({ feature: swapping ? "video-swap" : "motion-transfer", model: swapping && (!readyVideo || (isH3Open && images.length === 0)) ? "" : model, resolution: quality || undefined, duration, aspectRatio, ...(readyVideo ? { sourceVideo: readyVideo } : {}), ...(isH3Open && images.length ? { referenceImageCount: images.length } : {}), retry: quoteRetry });
  // The model takes a motion video of 3 to 30 seconds; the file comes from the device or from the picker.
  const acceptMotion = (file: File) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (probe.duration >= 3 && probe.duration <= 30) {
        setOwnMotion({ file, url });
        setSending({ state: "idle" });
      } else {
        URL.revokeObjectURL(url);
        setSending({ state: "error", message: c("templates.motion.durationRange") });
      }
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setSending({ state: "error", message: c("templates.motion.referenceFailed") });
    };
    probe.src = url;
  };
  // A model with a single image field uses the first image only.
  const firstOnly = swapping && images.length > 1 && !!model && !swapPicker.referenceOf(model)?.list;
  const modelImageLimit = swapping && model ? swapPicker.referenceOf(model)?.maxImages : undefined;
  const tooManyForModel = typeof modelImageLimit === "number" && images.length > modelImageLimit;
  // Generates right here: the images and the clip go up as files, then the same request the creator page sends; the app's
  // progress panel follows the job to the result (it names a swap like a motion transfer).
  const generate = async () => {
    if (imagesLoading || attachError) return setSending({ state: "error", message: attachError ?? c("templates.attach.loading") });
    if (configuredImages > 4) return setSending({ state: "error", message: c("templates.motion.referenceConfigurationInvalid") });
    if (!images.length) return setSending({ state: "error", message: c(swapping ? "templates.swap.needImage" : "templates.motion.needCharacter") });
    if (fixedImageSlots && images.length < imageLimit) return setSending({ state: "error", message: c("templates.motion.referenceRequired", { count: imageLimit }) });
    if (!ownMotion && !reference) return setSending({ state: "error", message: c("templates.motion.needReference") });
    if (!model) return setSending({ state: "error", message: c(swapping ? "templates.motion.serviceUnavailable" : "templates.motion.modelUnavailable") });
    if (!quality) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    if (swapping && !readyVideo) return setSending({ state: "error", message: c("templates.motion.videoPreparing") });
    if (swapping && credits === null) { setQuoteRetry((value) => value + 1); return setSending({ state: "error", message: c("templates.motion.quoteUnavailable") }); }
    if (firstOnly) return setSending({ state: "error", message: c("templates.swap.multipleUnsupported") });
    if (tooManyForModel) return setSending({ state: "error", message: c("templates.swap.modelImageLimit", { count: modelImageLimit ?? 0 }) });
    const instruction = (swapping ? (t?.prompt ?? "") : (promptRef.current?.value ?? ""))
      .replace(/\[describe the first person in the video\]/gi, "the first person in the video")
      .replace(/\[describe the second person in the video\]/gi, "the second person in the video")
      .trim();
    if (/\[describe [^\]]+\]/i.test(instruction)) return setSending({ state: "error", message: c(swapping ? "templates.motion.templatePromptIncomplete" : "templates.motion.completePrompt") });
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "motion-transfer", requestId });
    try {
      const uploaded = await Promise.all(images.map((image) => uploadImageAsset(image.file, { purpose: "content", feature: "motion-transfer" })));
      let video: string = reference ?? "";
      if (swapping && readyVideo) {
        video = readyVideo;
      } else if (ownMotion) {
        video = await uploadImageAsset(ownMotion.file, { purpose: "content", feature: "motion-transfer" });
        rememberVideoUpload(video);
      } else if (!/^https?:\/\//i.test(video)) {
        const response = await fetch(video);
        if (!response.ok) throw new Error(c("templates.motion.referenceFailed"));
        const blob = await response.blob();
        video = await uploadImageAsset(new File([blob], `${t?.slug ?? "motion"}.${blob.type.includes("webm") ? "webm" : "mp4"}`, { type: blob.type || "video/mp4" }), { purpose: "content", feature: "motion-transfer" });
      }
      const created = swapping
        ? await createVideoSwapGeneration({
            sourceVideo: video,
            sourceImages: uploaded,
            inputImages: uploaded,
            model,
            resolution: quality,
            ...(isH3Reference ? { duration, aspectRatio } : {}),
            ...(t ? { templateSlug: t.slug } : {}),
            ...(swapMode ? { swapMode: swapMode as "person" | "object" | "background" } : {}),
            ...(instruction ? { prompt: instruction } : {}),
          })
        : await createMotionTransferGeneration({
            sourceImage: uploaded[0],
            motionVideo: video,
            model,
            quality,
            ...(t ? { templateSlug: t.slug } : {}),
            // The model needs to know whether the character's pose follows the video or the image, so it is always sent.
            characterOrientation: orientation,
            // The background comes from the video (the character is put into its scene) or from the image (it is animated), for models that offer it.
            ...(sceneControl && motionPicker.modesOf(model).includes(sceneSource === "video" ? "replace" : "animate") ? { mode: sceneSource === "video" ? "replace" : "animate" } : {}),
            ...(instruction ? { prompt: instruction } : {}),
          });
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) {
        emitGenerationStarted({ feature: "motion-transfer", requestId, generationId, pollUrl, workspaceId: created.workspaceId, model, creditCost: credits ?? 0, status: created.status === "processing" ? "processing" : "queued" });
      }
      setSending({ state: "sent", message: c("templates.composer.sent") });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "motion-transfer", requestId });
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  return (
    <>
      {swapping ? (
        <div className={s.motionMediaGroup}>
          <div className={s.motionMediaHeading}>
            <span><Video size={15} aria-hidden="true" />{c("templates.motion.sourceVideoLabel")}</span>
          </div>
          <div className={s.motionBoxWrap}>
            <button type="button" className={`${s.motionBox} ${motionSrc ? `${s.motionBoxFilled} ${s.motionVideoBox} ${s.motionVideoEditBox}` : ""}`} aria-label={motionSrc ? c("templates.motion.changeVideo") : c("templates.motion.addMotion")} onClick={() => setMotionPickerOpen(true)}>
              {motionSrc ? (
                <span className={s.motionTilt}>
                  <video key={motionSrc} src={motionSrc} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
                </span>
              ) : (
                <>
                  <i className={s.motionBoxIcon} aria-hidden="true"><Video size={20} /></i>
                  <strong>{c("templates.motion.addMotion")}</strong>
                  <small>{c("templates.motion.motionHint")}</small>
                </>
              )}
            </button>
            {ownMotion && <button type="button" className={s.motionBoxClear} aria-label={c("templates.attach.remove")} onClick={() => setOwnMotion(null)}><X size={13} aria-hidden="true" /></button>}
          </div>
        </div>
      ) : (
        <div className={s.motionStack}>
          {/* As in a motion library: the motion to copy, then the character, each in its own box. */}
          <div className={s.motionBoxWrap}>
            <button type="button" className={`${s.motionBox} ${motionSrc ? `${s.motionBoxFilled} ${s.motionVideoBox}` : ""}`} onClick={() => setMotionPickerOpen(true)}>
              {motionSrc ? (
                <span className={s.motionTilt}>
                  <video key={motionSrc} src={motionSrc} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
                  <i aria-hidden="true"><Video size={12} /></i>
                </span>
              ) : (
                <>
                  <i className={s.motionBoxIcon} aria-hidden="true"><Video size={20} /></i>
                  <strong>{c("templates.motion.addMotion")}</strong>
                  <small>{c("templates.motion.motionHint")}</small>
                </>
              )}
            </button>
            {motionSrc && (
              <button type="button" className={s.motionBoxClear} aria-label={c("templates.attach.remove")} onClick={() => (ownMotion ? setOwnMotion(null) : onClear?.())}>
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={s.motionBoxWrap}>
            <button type="button" className={`${s.motionBox} ${images[0] ? s.motionBoxFilled : ""}`} onClick={() => setImagePickerOpen(true)}>
              {images[0] ? (
                <Image src={images[0].url} alt={c("templates.motion.character")} fill unoptimized sizes="320px" className={s.motionBoxImage} />
              ) : (
                <>
                  <i className={s.motionBoxIcon} aria-hidden="true"><User size={20} /></i>
                  <strong>{c("templates.motion.addCharacter")}</strong>
                  <small>{c("templates.motion.characterHint")}</small>
                </>
              )}
            </button>
            {images[0] && (
              <button type="button" className={s.motionBoxClear} aria-label={c("templates.attach.remove")} onClick={() => detach(images[0]!.id)}>
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
      <input
        ref={motionInputRef}
        className={s.visuallyHidden}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) acceptMotion(file);
        }}
      />
      <MotionVideoPicker
        open={motionPickerOpen}
        onClose={() => setMotionPickerOpen(false)}
        onUploadFromDevice={() => motionInputRef.current?.click()}
        onPick={acceptMotion}
      />
      <ImageAttachmentPicker
        open={imagePickerOpen}
        limit={swapping && !replacementId ? Math.max(0, imageLimit - images.length) : 1}
        onOpenChange={(open) => { setImagePickerOpen(open); if (!open) setReplacementId(null); }}
        onPick={(files, categories) => {
          if (replacementId) {
            replace(replacementId, files[0], categories[0]);
          } else {
            attach(files, categories);
          }
          setSending({ state: "idle" });
        }}
      />
      {(swapping || attachError || images.some((image) => image.fromTemplate)) && (
        <div className={`${s.motionThumbs} ${swapping ? s.motionReferenceGroup : ""}`}>
          {swapping && <>
            <div className={s.motionMediaHeading}><span><ImagePlus size={15} aria-hidden="true" />{c("templates.motion.referenceImages")}</span><small>{images.length} / {imageLimit}</small></div>
            <div className={s.motionReferenceList}>
              {images.map((image, index) => (
                <span key={image.id} className={s.motionReferenceThumb} title={image.file.name}>
                  <button type="button" className={s.motionReferenceEdit} aria-label={c("templates.motion.replaceReference", { number: (image.slot ?? index) + 1 })} onClick={() => { setReplacementId(image.id); setImagePickerOpen(true); }}>
                    <Image src={image.url} alt={c("templates.motion.referenceImage", { number: (image.slot ?? index) + 1 })} fill unoptimized sizes="64px" />
                    <span className={s.motionReferenceEditLabel}>{c("templates.motion.replaceReferenceShort")}</span>
                  </button>
                  <span className={s.motionReferenceNumber}>{(image.slot ?? index) + 1}</span>
                  {image.category && <em className={s.slotCategory}>{c(referenceCategoryCopyKeys[image.category])}</em>}
                  <button type="button" className={s.motionReferenceRemove} aria-label={c("templates.motion.removeReference", { number: (image.slot ?? index) + 1 })} onClick={() => detach(image.id)}><X size={12} aria-hidden="true" /></button>
                </span>
              ))}
              {images.length < imageLimit && <button type="button" className={s.motionReferenceAdd} disabled={imagesLoading} onClick={() => setImagePickerOpen(true)} aria-label={c("templates.attach.add")}><Plus size={18} aria-hidden="true" /><span>{c("templates.motion.addReference")}</span></button>}
            </div>
          </>}
          <small className={attachError || firstOnly || tooManyForModel ? s.sendError : undefined} role={attachError || firstOnly || tooManyForModel ? "alert" : undefined}>
            {attachError ?? (firstOnly ? c("templates.swap.multipleUnsupported") : tooManyForModel ? c("templates.swap.modelImageLimit", { count: modelImageLimit ?? 0 }) : images.some((image) => image.fromTemplate) ? c("templates.attach.fromTemplate") : "")}
          </small>
        </div>
      )}
      {!swapping && picker.ready && !model && <p className={s.sendError} role="alert">{c("templates.motion.modelUnavailable")}</p>}
      {configuredImages > 4 && <p className={s.sendError} role="alert">{c("templates.motion.referenceConfigurationInvalid")}</p>}
      {videoPrepareFailed && <p className={s.sendError} role="alert">{c("templates.motion.videoPrepareFailed")} <button type="button" onClick={() => { setPreparedVideo(null); setVideoRetry((value) => value + 1); }}>{c("templates.retry")}</button></p>}
      <div className={s.motionDropdownField}>
        <span>{c("templates.edit.setting.quality")}</span>
        <Dropdown ariaLabel={c("templates.edit.setting.quality")} value={quality} placeholder={c("templates.composer.pickQuality")} options={qualityChoices.map((label) => ({ value: label, label }))} onChange={(value) => pick({ quality: value })} menuPosition="fixed" />
      </div>
      {isH3Reference && <div className={s.motionDropdownField}>
        <span>{c("templates.composer.duration")}</span>
        <Dropdown ariaLabel={c("templates.composer.duration")} value={String(duration ?? 6)} options={Array.from({ length: isH3Open ? 13 : 12 }, (_, index) => ({ value: String(index + (isH3Open ? 3 : 4)), label: c("templates.preview.seconds", { value: index + (isH3Open ? 3 : 4) }) }))} onChange={(value) => pick({ duration: Number(value) })} menuPosition="fixed" />
      </div>}
      {swapping ? (
        <>
          {swapModes.length > 0 && (
            <section className={s.motionSceneControl} data-scene-enabled="true" style={{ height: "auto" }}>
              <strong>{c("templates.swap.modeLabel")}</strong>
              <div className={s.motionSourceTabs} role="group" aria-label={c("templates.swap.modeLabel")}>
                {swapModes.map((id) => (
                  <button key={id} type="button" aria-pressed={swapMode === id} onClick={() => pick({ swapMode: id })}>
                    {c(`templates.swap.mode.${id}` as StudioCopyKey)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <section className={s.motionSceneControl} data-scene-enabled={sceneControl}>
            <button type="button" role="switch" aria-checked={sceneControl} onClick={() => setSceneControl((value) => !value)}>
              <strong>{c("templates.motion.sceneControl")}</strong><i />
            </button>
            {sceneControl ? <>
              <div className={s.motionSourceTabs} role="group" aria-label={c("templates.motion.sourceAria")}>
                {(["video", "image"] as const).map((source) => <button key={source} type="button" aria-pressed={sceneSource === source} onClick={() => setSceneSource(source)}>{source === "video" ? <Video size={13} /> : <ImagePlus size={13} />}{c(source === "video" ? "templates.motion.sourceVideo" : "templates.motion.sourceImage")}</button>)}
              </div>
              <p>{c("templates.motion.sceneHint")}</p>
            </> : <p>{c("templates.motion.sceneDisabledHint")}</p>}
          </section>
          <details className={`${s.composerAdvanced} ${s.motionAdvanced}`} open>
            <summary>{c("templates.composer.advanced")}<ChevronDown size={15} aria-hidden="true" /></summary>
            <label className={s.motionAdvancedLabel}>
              {c("templates.composer.prompt")}
              <textarea
                key={`${t?.id}-${locale}-motion`}
                ref={promptRef}
                className={s.composerPrompt}
                defaultValue={t?.prompt ?? ""}
                placeholder={c("templates.motion.promptPlaceholder")}
              />
            </label>
            <div className={s.motionAdvancedLabel}>
              {c("templates.motion.orientation")}
              <div className={s.motionSourceTabs} role="group" aria-label={c("templates.motion.orientation")}>
                {(["video", "image"] as const).map((source) => <button key={source} type="button" aria-pressed={orientation === source} onClick={() => setOrientation(source)}>{source === "video" ? <Video size={13} /> : <ImagePlus size={13} />}{c(source === "video" ? "templates.motion.sourceVideo" : "templates.motion.sourceImage")}</button>)}
              </div>
              <p>{c("templates.motion.orientationHint")}</p>
            </div>
          </details>
        </>
      )}
      <div className={s.motionGenerateDock}>
        <button type="button" disabled={sending.state === "busy" || imagesLoading || !picker.ready} onClick={() => void generate()}>
          {sending.state === "busy" ? c("templates.composer.sending") : c("templates.edit.generate")} <Sparkles size={15} />{creditText(credits)}
        </button>
        {sending.message && <p role={sending.state === "error" ? "alert" : "status"} className={sending.state === "error" ? s.sendError : s.sendNote}>{sending.message}</p>}
      </div>
    </>
  );
}
