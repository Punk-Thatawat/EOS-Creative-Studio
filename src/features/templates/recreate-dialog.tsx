import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles, User, X } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import {
  createTextVideoGeneration,
  type TextVideoGenerationInput,
} from "@/lib/api/text-video-generations";
import { uploadImageAsset } from "@/lib/api/storage";
import { formatGenerationError } from "@/lib/api/generation-errors";
import {
  emitGenerationRequestFailed,
  emitGenerationStarted,
  emitGenerationSubmitting,
} from "@/lib/generation-progress-events";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import { name, promptOf, valid } from "./template-text";
import { creditText, useCreditQuote, useModelPicker } from "./use-template-quote";

type PickedImage = { file: File; url: string };

/** The Recreate window of a product template: the visitor's product (required), a person (optional) and what to change. */
export function RecreateDialog({ t, onClose, onStarted }: { t: Template; onClose: () => void; onStarted: (t: Template) => void }) {
  const { c, locale } = useStudioCopy();
  const ref = useRef<HTMLDialogElement>(null);
  const picker = useModelPicker("text-to-video");
  const [product, setProduct] = useState<PickedImage | null>(null);
  const [avatar, setAvatar] = useState<PickedImage | null>(null);
  const [edit, setEdit] = useState("");
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "error"; message?: string }>({ state: "idle" });
  const productInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const picked = useRef({ product, avatar });
  useEffect(() => {
    picked.current = { product, avatar };
  }, [product, avatar]);
  useEffect(() => {
    const el = ref.current,
      overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      if (picked.current.product) URL.revokeObjectURL(picked.current.product.url);
      if (picked.current.avatar) URL.revokeObjectURL(picked.current.avatar.url);
    };
  }, []);
  const settings = t.settings ?? {};
  // A model that takes a list of reference images: the reference-to-video one when it is offered, else the template's own.
  const takesList = (id: string) => picker.referenceOf(id)?.list === true;
  const templateModel = typeof settings.model === "string" ? settings.model : "";
  const model =
    picker.options.find((o) => o.id.endsWith("/reference-to-video") && takesList(o.id))?.id ??
    (templateModel && takesList(templateModel) ? templateModel : picker.options.find((o) => takesList(o.id))?.id ?? "");
  const qualities = picker.qualitiesOf(model);
  const resolution = typeof settings.resolution === "string" && qualities.includes(settings.resolution) ? settings.resolution : (qualities[0] ?? "");
  const duration = picker.durationFor(model, typeof settings.duration === "number" ? settings.duration : 5);
  const wantedRatio = typeof settings.ratio === "string" ? settings.ratio : typeof settings.aspectRatio === "string" ? settings.aspectRatio : "16:9";
  const ratios = picker.ratiosOf(model);
  const aspectRatio = ratios.length && !ratios.includes(wantedRatio) ? (ratios.includes("16:9") ? "16:9" : ratios[0]) : wantedRatio;
  const credits = useCreditQuote({ feature: "text-to-video", model, resolution, duration, aspectRatio });
  const choose = (list: FileList | null, set: (image: PickedImage | null) => void, current: PickedImage | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setSending({ state: "error", message: c("templates.attach.unsupported") });
    if (current) URL.revokeObjectURL(current.url);
    set({ file, url: URL.createObjectURL(file) });
    setSending({ state: "idle" });
  };
  const clear = (current: PickedImage | null, set: (image: PickedImage | null) => void) => {
    if (current) URL.revokeObjectURL(current.url);
    set(null);
  };
  const recreate = async () => {
    if (!product) return setSending({ state: "error", message: c("templates.recreate.needProduct") });
    const reference = picker.referenceOf(model);
    if (!model || !reference || !resolution) return setSending({ state: "error", message: c("templates.recreate.noModel") });
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "text-to-video", requestId });
    try {
      const urls = await Promise.all([product, avatar].filter((image): image is PickedImage => image !== null).map((image) => uploadImageAsset(image.file, { purpose: "content", feature: "text-to-video" })));
      const lines = [promptOf(t, locale)];
      if (edit.trim()) lines.push(edit.trim());
      lines.push(avatar ? "Use @Image 1 as the product shown in the video, and @Image 2 as the person who shows it." : "Use @Image 1 as the product shown in the video.");
      const request: TextVideoGenerationInput = { prompt: lines.join("\n\n"), model, resolution, duration, aspectRatio, templateSlug: t.slug };
      request.modelParams = { [reference.parameter]: reference.list ? urls : urls[0] };
      request.inputImages = urls;
      const created = await createTextVideoGeneration(request);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) {
        emitGenerationStarted({ feature: "text-to-video", requestId, generationId, pollUrl, workspaceId: created.workspaceId, model, creditCost: credits ?? 0, status: created.status === "processing" ? "processing" : "queued" });
      }
      onStarted(t);
    } catch (error) {
      emitGenerationRequestFailed({ feature: "text-to-video", requestId });
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  const slot =(label: string, flag: string, required: boolean, image: PickedImage | null, set: (image: PickedImage | null) => void, input: React.RefObject<HTMLInputElement | null>, cta: string, Icon: typeof Plus) => (
    <div className={s.recreateSlot}>
      <span className={s.recreateLabel}>{label}</span>
      <button type="button" className={s.recreateBox} onClick={() => input.current?.click()} aria-label={cta}>
        <span className={s.recreateFlag}>{flag}</span>
        {image ? (
          <Image src={image.url} alt="" fill unoptimized sizes="200px" className={s.recreatePicked} />
        ) : (
          <>
            <span className={s.recreateIcon} aria-hidden="true"><Icon size={16} /></span>
            <strong>{cta}</strong>
          </>
        )}
      </button>
      {image && (
        <button type="button" className={s.recreateRemove} onClick={() => clear(image, set)} aria-label={c("templates.attach.remove")}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          choose(e.target.files, set, image);
          e.target.value = "";
        }}
      />
      <span hidden>{required ? "required" : "optional"}</span>
    </div>
  );
  return (
    <dialog
      ref={ref}
      className={s.recreateDialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={c("templates.recreate.title")}
    >
      <button type="button" className={s.previewClose} onClick={onClose} aria-label={c("templates.preview.close")}>
        <X size={20} aria-hidden="true" />
      </button>
      <div className={s.recreateLayout}>
        <div className={s.recreateArt}>
          {valid(t.previewUrl) ? (
            <video src={t.previewUrl} poster={valid(t.thumbnailUrl) ? t.thumbnailUrl : undefined} autoPlay muted loop playsInline aria-label={name(t, locale)} />
          ) : valid(t.thumbnailUrl) ? (
            <Image src={t.thumbnailUrl} alt={name(t, locale)} fill unoptimized sizes="460px" />
          ) : null}
        </div>
        <div className={s.recreateForm}>
          <h2>{c("templates.recreate.title")}</h2>
          <div className={s.recreateSlots}>
            {slot(c("templates.recreate.product"), c("templates.recreate.required"), true, product, setProduct, productInput, c("templates.recreate.uploadProduct"), Plus)}
            {slot(c("templates.recreate.avatar"), c("templates.composer.optional"), false, avatar, setAvatar, avatarInput, c("templates.recreate.uploadAvatar"), User)}
          </div>
          <label className={s.recreateLabel} htmlFor="recreate-edit">{c("templates.recreate.describe")}</label>
          <textarea
            id="recreate-edit"
            className={s.recreateEdit}
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
            placeholder={c("templates.recreate.placeholder")}
            maxLength={1000}
          />
          {sending.state === "error" && <p className={s.recreateError} role="alert">{sending.message}</p>}
          <button type="button" className={s.recreateGo} onClick={() => void recreate()} disabled={sending.state === "busy"}>
            {sending.state === "busy" ? <Loader2 size={16} className={s.recreateSpin} aria-hidden="true" /> : null}
            {c("templates.recreate.button")}
            {credits !== null && (
              <span className={s.recreateCost}>
                <Sparkles size={14} aria-hidden="true" />
                {creditText(credits)}
              </span>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
