import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Package,
  Plus,
  Search,
  Shirt,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { categoryLabel } from "./template-categories";
import {
  referenceCategoryCopyKeys,
  referenceCategoryOf,
  type ReferenceCategory,
} from "./template-references";
import {
  createTextVideoGeneration,
  type TextVideoGenerationInput,
} from "@/lib/api/text-video-generations";
import { uploadImageAsset } from "@/lib/api/storage";
import { ImageAttachmentPicker } from "@/features/brand-kit/image-attachment-picker";
import { longClipModels, queueExtension } from "./long-clip";
import { formatGenerationError } from "@/lib/api/generation-errors";
import { startTemplateWorkflow, workflowFeature } from "@/lib/api/template-workflows";
import {
  emitGenerationRequestFailed,
  emitGenerationStarted,
  emitGenerationSubmitting,
} from "@/lib/generation-progress-events";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import {
  editTools,
  heroKeys,
  kindKeys,
  modeKeys,
  modes,
  type EditToolId,
  type Mode,
  workflowEvent,
} from "./library-modes";
import { name, promptOf, valid } from "./template-text";
import { presetFacts } from "./preset-facts";
import { type StyleChoice } from "./custom-styles";
import { inputImagesOf, type AttachedImage, useTemplateImages } from "./use-template-images";
import { creditText, useCreditQuote, useModelPicker, useWorkflowQuote } from "./use-template-quote";
import { Media } from "./template-media";
import { EditWorkspace, type FlyoutOption } from "./edit-workspace";
import { MotionWorkspace } from "./motion-workspace";
import { PickerRow } from "./picker-row";

/** Sent with a clip made from the blank form, so it is listed in the history of this page like the clips made from a template. */
const FREE_CREATE_SLUG = "free-create";

/** The panel of Create Video when no template is picked: a blank form, so a visitor can make a clip without one. */
const blankTemplate: Template = {
  id: "free-create",
  slug: "",
  title: "",
  description: "",
  category: "Video",
  kind: "video",
  format: "Video",
  thumbnailUrl: "",
  targetPath: "",
  prompt: "",
  tags: [],
  featured: false,
  createdAt: "",
  updatedAt: "",
  settings: {},
};

export function Composer({
  t: chosen,
  mode,
  onMode,
  options,
  onSelect,
  onClear,
  style,
  onChangeStyle,
  onClearStyle,
  onUse,
  onExpand,
  incoming,
}: {
  t?: Template;
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** Images the visitor added in the clip details, put in the attach card when it changes. */
  incoming?: { key: number; templateId: string; files: File[] } | null;
  /** The look picked in the Styles tab, if any. */
  style: StyleChoice | null;
  onChangeStyle: () => void;
  onClearStyle: () => void;
  /** Every template of this mode, for the "change" list. */
  options: Template[];
  onSelect: (id: string) => void;
  /** Takes the chosen template off the panel (the cross on its card). */
  onClear: () => void;
  onUse: (t: Template) => void;
  onExpand: (t: Template) => void;
}) {
  const { c, locale } = useStudioCopy();
  // No template picked in Create Video: the form is blank and the visitor writes the prompt and picks the settings.
  const free = !chosen && mode === "create";
  const t = chosen ?? (free ? blankTemplate : undefined);
  const [picking, setPicking] = useState(false);
  const [pickingEditTool, setPickingEditTool] = useState(false);
  const [editToolId, setEditToolId] = useState<EditToolId | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [useFree, setUseFree] = useState(false);
  // What was picked in the two lists; for now it only changes what the rows show.
  const [picks, setPicks] = useState<{ templateId: string; model?: string; quality?: string; duration?: number }>({ templateId: "" });
  // A workflow template runs two steps on the server (an image, then a video from it), each with its own model and quality.
  const isWorkflow = t?.settings?.feature === workflowFeature;
  const picker = useModelPicker(mode === "motion" ? "motion-transfer" : mode === "edit" ? "extend-video" : "text-to-video", !isWorkflow);
  const imagePicker = useModelPicker("text-to-image", isWorkflow);
  const videoPicker = useModelPicker("image-to-video", isWorkflow);
  const [flow, setFlow] = useState({ imageModel: "", imageQuality: "", videoModel: "", videoQuality: "" });
  // The models the template was set up with start the two steps until the visitor picks others.
  const flowImageModel = flow.imageModel || (typeof t?.settings?.imageModel === "string" ? t.settings.imageModel : "");
  const flowVideoModel = flow.videoModel || (typeof t?.settings?.model === "string" ? t.settings.model : "");
  // Reference images attached in the optional card (up to five), sent with the video request when the model takes them.
  // The images a template was made with start in it.
  const { images, attach: attachImages, detach, error: attachError } = useTemplateImages(t, 5, !isWorkflow);
  const [pickerOpen, setPickerOpen] = useState(false);
  const attach = (files: File[], categories?: Array<ReferenceCategory | undefined>, templateIndex?: number) => {
    attachImages(files, categories, templateIndex);
    setSending({ state: "idle" });
  };
  // A template with reference images gives one labelled box for each, and a box stays when its image is taken out.
  const slotPlan: Array<ReferenceCategory | undefined> = !free && !isWorkflow && t ? inputImagesOf(t).slice(0, 5).map((address) => referenceCategoryOf(t.settings, address)) : [];
  const emptySlots = slotPlan.filter((_, slotIndex) => !images.some((image) => image.templateIndex === slotIndex)).length;
  // The box the picker or the file chooser fills next.
  const slotTargetRef = useRef<number | undefined>(undefined);
  const takeSlotTarget = () => {
    const slot = slotTargetRef.current;
    slotTargetRef.current = undefined;
    return slot;
  };
  const openPicker = (slot?: number) => {
    slotTargetRef.current = slot;
    setPickerOpen(true);
  };
  const imageCell = (image: AttachedImage, caption: string) => (
    <span key={image.id} className={s.slotCell}>
      <span className={`${s.slotFile} ${image.fromTemplate ? s.slotFromTemplate : ""}`} title={image.file.name}>
        <Image src={image.url} alt={image.file.name} fill unoptimized sizes="64px" />
        <button type="button" className={s.slotRemove} aria-label={c("templates.attach.remove")} onClick={() => detach(image.id)}>
          <X size={11} aria-hidden="true" />
        </button>
      </span>
      <em className={s.slotCaption}>{caption}</em>
    </span>
  );
  // The price follows the model and quality the panel shows: picked here, else the template's own.
  const quoteModel = t && picks.templateId === t.id && picks.model ? picks.model : typeof t?.settings?.model === "string" ? t.settings.model : picker.preferredModel;
  const quoteQuality = t && picks.templateId === t.id && picks.quality ? picks.quality : typeof t?.settings?.resolution === "string" ? t.settings.resolution : undefined;
  // The creator's own defaults when the template does not say: 5 seconds, 16:9.
  const templateDuration = typeof t?.settings?.duration === "number" ? t.settings.duration : 5;
  // The length picked in the panel, else the template's own.
  const wantedDuration = t && picks.templateId === t.id && picks.duration ? picks.duration : templateDuration;
  const wantedRatio = typeof t?.settings?.ratio === "string" ? t.settings.ratio : typeof t?.settings?.aspectRatio === "string" ? t.settings.aspectRatio : "16:9";
  // A template made from another model's clip can name a ratio this model refuses (21:9 on Omni); use one it accepts.
  const duration = picker.durationFor(quoteModel, wantedDuration);
  const modelRatios = picker.ratiosOf(quoteModel);
  const aspectRatio = modelRatios.length && !modelRatios.includes(wantedRatio) ? (modelRatios.includes("16:9") ? "16:9" : modelRatios[0]) : wantedRatio;
  // A clip longer than the model makes at once is made in two parts: its first 30 seconds, then the rest as an extension.
  const firstPart = longClipModels.test(quoteModel) ? Math.min(duration, picker.onceOf(quoteModel) ?? duration) : duration;
  const restPart = duration - firstPart;
  const firstCredits = useCreditQuote({ feature: "text-to-video", model: mode === "create" ? quoteModel : "", resolution: quoteQuality, duration: firstPart, aspectRatio });
  // The extension is billed for its new seconds only, at the model's rate per second, so the price shown is the first part's rate times the whole length.
  const credits = restPart > 0 && firstCredits !== null ? (firstCredits * duration) / firstPart : firstCredits;
  const imageRatio = ["1:1", "16:9", "4:3", "3:4", "9:16"].includes(wantedRatio) ? wantedRatio : "16:9";
  const flowVideoRatios = videoPicker.ratiosOf(flowVideoModel);
  const videoRatio = flowVideoRatios.length && !flowVideoRatios.includes(imageRatio) ? (flowVideoRatios.includes("16:9") ? "16:9" : (flowVideoRatios[0] ?? imageRatio)) : imageRatio;
  const workflowCredits = useWorkflowQuote(
    isWorkflow && flowImageModel && flow.imageQuality && flowVideoModel && flow.videoQuality
      ? { imageModel: flowImageModel, imageKey: imagePicker.qualityKeyOf(flowImageModel), imageQuality: flow.imageQuality, imageRatio, videoModel: flowVideoModel, videoQuality: flow.videoQuality, duration: videoPicker.durationFor(flowVideoModel, wantedDuration), aspectRatio: videoRatio }
      : null,
  );
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState<{ state: "idle" | "busy" | "sent" | "error"; message?: string }>({ state: "idle" });
  const handledIncoming = useRef<number | null>(null);
  useEffect(() => {
    if (!incoming || incoming.templateId !== t?.id || handledIncoming.current === incoming.key || mode !== "create" || isWorkflow) return;
    handledIncoming.current = incoming.key;
    attach(incoming.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for each batch of images the details hand over
  }, [incoming, mode, isWorkflow, t?.id]);
  // Generates right here: the same request the creator page sends, then the app's progress panel follows it to the result.
  const generate = async (template: Template, model: string, resolution: string) => {
    const prompt = (promptRef.current?.value ?? promptOf(template, locale)).trim();
    if (!prompt) return setSending({ state: "error", message: c("templates.composer.needPrompt") });
    if (!model) return setSending({ state: "error", message: c("templates.composer.pickModel") });
    if (!resolution) return setSending({ state: "error", message: c("templates.composer.pickQuality") });
    const reference = picker.referenceOf(model);
    if (images.length && !reference) {
      // Say which models do take them, so the fix is one pick away.
      const capable = picker.options.filter((o) => picker.referenceOf(o.id)).map((o) => o.label).join(", ");
      return setSending({ state: "error", message: c("templates.attach.noReference", { models: capable || "-" }) });
    }
    const requestId = crypto.randomUUID();
    setSending({ state: "busy" });
    emitGenerationSubmitting({ feature: "text-to-video", requestId });
    try {
      const request: TextVideoGenerationInput = { prompt, model, resolution, duration: firstPart, aspectRatio, templateSlug: free ? FREE_CREATE_SLUG : template.slug };
      if (images.length && reference) {
        const urls = await Promise.all(images.map((image) => uploadImageAsset(image.file, { purpose: "content", feature: "text-to-video" })));
        // The reference-to-video models follow the images the prompt names as "@Image 1"; say so when the prompt does not.
        if (model.endsWith("/reference-to-video") && !/@Image\s*\d/i.test(prompt)) {
          request.prompt = `${prompt}\n\nUse the reference images to keep the same subjects and look: ${urls.map((_, index) => `@Image ${index + 1}`).join(", ")}.`;
        }
        // Model-specific inputs go in modelParams: the server only forwards those to the model (a top-level field is dropped).
        request.modelParams = { ...(request.modelParams ?? {}), [reference.parameter]: reference.list ? urls : urls[0] };
        // Kept with the clip, so it can become a template with the images it was made from.
        request.inputImages = urls;
      }
      const created = await createTextVideoGeneration(request);
      if (created.workspaceId) window.sessionStorage.setItem("eos.generation.workspace-id", created.workspaceId);
      const generationId = created.generationId ?? created.id;
      const pollUrl = created.pollUrl ?? (generationId ? `/generations/${encodeURIComponent(generationId)}/status` : "");
      if (generationId && pollUrl) {
        emitGenerationStarted({ feature: "text-to-video", requestId, generationId, pollUrl, workspaceId: created.workspaceId, model, creditCost: firstCredits ?? 0, status: created.status === "processing" ? "processing" : "queued" });
        if (restPart > 0) queueExtension({ generationId, pollUrl, prompt: request.prompt, duration: restPart, resolution, aspectRatio, templateSlug: free ? FREE_CREATE_SLUG : template.slug });
      }
      if (!free) onUse(template);
      setSending({ state: "sent", message: c("templates.composer.sent") });
    } catch (error) {
      emitGenerationRequestFailed({ feature: "text-to-video", requestId });
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  const generateWorkflow = async (template: Template) => {
    const prompt = (promptRef.current?.value ?? promptOf(template, locale)).trim();
    if (!prompt) return setSending({ state: "error", message: c("templates.composer.needPrompt") });
    if (!flowImageModel || !flow.imageQuality) return setSending({ state: "error", message: c("templates.workflow.pickImage") });
    if (!flowVideoModel || !flow.videoQuality) return setSending({ state: "error", message: c("templates.workflow.pickVideo") });
    setSending({ state: "busy" });
    try {
      await startTemplateWorkflow({
        templateSlug: template.slug,
        prompt,
        image: { model: flowImageModel, [imagePicker.qualityKeyOf(flowImageModel)]: flow.imageQuality, ratio: imageRatio },
        video: { model: flowVideoModel, resolution: flow.videoQuality, duration: videoPicker.durationFor(flowVideoModel, wantedDuration), aspectRatio: videoRatio },
      });
      window.dispatchEvent(new Event(workflowEvent));
      onUse(template);
      setSending({ state: "sent", message: c("templates.workflow.sent") });
    } catch (error) {
      setSending({ state: "error", message: formatGenerationError(error, c("templates.composer.generateFailed")) });
    }
  };
  const tabs = (
    <div className={s.composerTabs} role="tablist" aria-label={c("templates.mode.aria")}>
      {modes.map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => onMode(m)}>
          {c(modeKeys[m])}
        </button>
      ))}
    </div>
  );
  const needle = pickQuery.trim().toLowerCase();
  const listed = options.filter((o) => !needle || `${name(o, locale)} ${o.category} ${o.format}`.toLowerCase().includes(needle));
  const activeEditTool = editTools.find(({ id }) => id === editToolId) ?? editTools[0];
  const banner = (
    <div className={s.composerHeroWrap}>
      <div
        className={`${s.composerHero}${mode === "edit" ? ` ${s.editComposerHero}` : ""}`}
        style={t && valid(t.thumbnailUrl) ? { backgroundImage: `url("${t.thumbnailUrl}")` } : undefined}
      >
        {/* The banner moves with the template's own preview clip (set in the back office); without one it shows the cover. */}
        {mode !== "edit" && t?.kind === "video" && valid(t.previewUrl) && (
          <video
            key={t.previewUrl}
            className={s.composerHeroVideo}
            src={t.previewUrl}
            poster={valid(t.thumbnailUrl) ? t.thumbnailUrl : undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
        <strong>{c(mode === "edit" ? editToolId ? activeEditTool.title : "templates.edit.list.title" : modeKeys[mode])}</strong>
        <small>{c(mode === "edit" ? editToolId ? activeEditTool.desc : "templates.edit.list.desc" : heroKeys[mode].tag)}</small>
      </div>
      {(options.length > 0 || mode === "edit") && (
        <button
          type="button"
          className={s.composerHeroChange}
          aria-expanded={mode === "edit" ? pickingEditTool : picking}
          onClick={() => mode === "edit" ? setPickingEditTool((v) => !v) : setPicking((v) => !v)}
        >
          {c("templates.composer.pick")}
        </button>
      )}
      {pickingEditTool && mode === "edit" && (
        <>
          <button type="button" className={s.pickerBackdrop} aria-label={c("templates.composer.closePicker")} onClick={() => setPickingEditTool(false)} />
          <div className={s.picker}>
            <span className={s.pickerHeading}>{c("templates.edit.tools.heading")}</span>
            <ul>
              {editTools.map(({ id, icon: Icon, title, desc, isNew }) => (
                <li key={id}>
                  <button type="button" aria-current={id === editToolId ? "true" : undefined} onClick={() => { setEditToolId(id); setPickingEditTool(false); }}>
                    <span className={s.editPickerIcon}><Icon size={17} /></span>
                    <span className={s.pickerCopy}><strong>{c(title)}{isNew && <em>{c("templates.tab.new")}</em>}</strong><small>{c(desc)}</small></span>
                    {id === editToolId && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {picking && mode !== "edit" && (
        <>
          <button type="button" className={s.pickerBackdrop} aria-label={c("templates.composer.closePicker")} onClick={() => setPicking(false)} />
          <div className={s.picker}>
            <label className={s.pickerSearch}>
              <Search size={15} aria-hidden="true" />
              <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder={c("templates.picker.search")} autoFocus />
            </label>
            <span className={s.pickerHeading}>{c("templates.picker.heading")}</span>
            <ul>
              {listed.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    aria-current={o.id === t?.id ? "true" : undefined}
                    onClick={() => {
                      onSelect(o.id);
                      setPicking(false);
                    }}
                  >
                    <span
                      className={s.pickerThumb}
                      style={valid(o.thumbnailUrl) ? { backgroundImage: `url("${o.thumbnailUrl}")` } : undefined}
                      aria-hidden="true"
                    />
                    <span className={s.pickerCopy}>
                      <strong>{name(o, locale)}</strong>
                      <small>
                        {c(kindKeys[o.kind])} · {categoryLabel(o.category, locale)} · {o.format}
                      </small>
                    </span>
                    {o.id === t?.id && <Check size={16} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
  // As in the example: a row that applies a style (the layout only for now).
  const styleRow = (
    <div className={s.styleRow}>
      <span
        className={s.styleThumb}
        style={style ? { backgroundImage: `url("${style.imageUrl}")` } : undefined}
        aria-hidden="true"
      />
      <span className={s.styleName}>
        <small>{c("templates.composer.style")}</small>
        <strong title={style?.name}>{style ? style.name : c("templates.composer.styleNone")}</strong>
      </span>
      <button type="button" className={s.styleChange} onClick={onChangeStyle}>
        {c("templates.composer.styleChange")}
      </button>
      {style && (
        <button type="button" className={s.styleClear} aria-label={c("templates.styles.remove")} onClick={onClearStyle}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
  if (mode === "motion")
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <MotionWorkspace key={chosen?.id ?? "empty-motion"} t={chosen} onClear={onClear} incoming={incoming} />
      </aside>
    );
  if (mode === "edit" && !editToolId)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <ul className={s.toolList}>
          {editTools.map(({ id, icon: Icon, title, desc, isNew }) => (
            <li key={id}>
              <button type="button" className={s.toolRow} onClick={() => setEditToolId(id)}>
                <Icon size={20} aria-hidden="true" />
                <span>
                  <strong>{c(title)}{isNew && <em>{c("templates.tab.new")}</em>}</strong>
                  <small>{c(desc)}</small>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  if (mode === "edit" && editToolId)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        <button type="button" className={s.editBack} onClick={() => setEditToolId(null)}><ChevronLeft size={15} />{c("templates.edit.tools.heading")}</button>
        <EditWorkspace tool={editToolId} poster={t?.thumbnailUrl} />
      </aside>
    );
  if (!t)
    return (
      <aside className={s.composer} aria-label={c("templates.composer.aria")}>
        {tabs}
        {banner}
        {styleRow}
        <p className={s.composerEmpty}>{c("templates.composer.empty")}</p>
      </aside>
    );
  const facts = presetFacts(t, c);
  const primary = facts.filter((f) => f.key === "model" || f.key === "resolution");
  const advanced = facts.filter((f) => f.key !== "model" && f.key !== "resolution");
  // Models and qualities seen in the templates, each with the details of the first template that uses it.
  const modelMap = new Map<string, FlyoutOption>();
  for (const o of [t, ...options]) {
    const settings = o.settings ?? {};
    const model = typeof settings.model === "string" ? settings.model : typeof settings.modelId === "string" ? settings.modelId : "";
    if (!model) continue;
    const entry = modelMap.get(model) ?? { id: model, label: model, chips: [] as string[] };
    if (o.featured && !entry.badge) entry.badge = c("templates.sortRecommended");
    for (const extra of [settings.resolution, typeof settings.duration === "number" ? c("templates.preview.seconds", { value: settings.duration }) : undefined]) {
      if ((typeof extra === "string" || typeof extra === "number") && !entry.chips?.includes(String(extra))) entry.chips?.push(String(extra));
    }
    modelMap.set(model, entry);
  }
  // The creator's own list of models when it loads; until then, the ones the templates mention.
  const baseModels = picker.options.length ? picker.options : [...modelMap.values()];
  // With images attached, the models that take them come first and are marked, so the right one is easy to pick.
  const modelOptions = images.length
    ? [...baseModels]
        .sort((a, b) => Number(!!picker.referenceOf(b.id)) - Number(!!picker.referenceOf(a.id)))
        .map((o) => (picker.referenceOf(o.id) ? { ...o, chips: [c("templates.attach.accepts"), ...(o.chips ?? [])] } : o))
    : baseModels;
  // Nothing picked and nothing in the template: the rows ask for a choice.
  const shownModel = (picks.templateId === t.id && picks.model) || primary.find((f) => f.key === "model")?.value || picker.preferredModel;
  const shownQuality = (picks.templateId === t.id && picks.quality) || primary.find((f) => f.key === "resolution")?.value || "";
  const qualityIds = new Set(picker.qualitiesOf(shownModel).length ? picker.qualitiesOf(shownModel) : ["480p", "720p", "1080p"]);
  for (const o of [t, ...options]) {
    const resolution = o.settings?.resolution;
    if (typeof resolution === "string") qualityIds.add(resolution);
  }
  const qualityOptions: FlyoutOption[] = [...qualityIds].map((id) => ({ id, label: id }));
  // A value the visitor has not changed and that the template sets is marked, so it is clear where it came from.
  const picked = picks.templateId === t.id;
  const templateNote = c("templates.composer.fromTemplateNote");
  const modelNote = !(picked && picks.model) && typeof t.settings?.model === "string" ? templateNote : undefined;
  const qualityNote = !(picked && picks.quality) && typeof t.settings?.resolution === "string" ? templateNote : undefined;
  const durationNote = !(picked && picks.duration) && typeof t.settings?.duration === "number" ? templateNote : undefined;
  return (
    <aside className={s.composer} aria-label={c("templates.composer.aria")}>
      {tabs}
      {banner}
      {styleRow}
      {!free && <div className={s.composerStage}>
        <button type="button" className={s.cardClose} onClick={onClear} aria-label={c("templates.composer.remove")}>
          <X size={14} aria-hidden="true" />
        </button>
        <button type="button" className={s.composerCard} onClick={() => onExpand(t)} aria-label={c("templates.card.previewAria", { name: name(t, locale) })}>
          <Media t={t} tile key={t.id + t.previewUrl} />
          <span className={s.cardIcon} aria-hidden="true">
            <Expand size={14} />
          </span>
          <span className={s.composerChange}>{c("templates.composer.change")}</span>
          <span className={s.composerCardInfo}>
            <strong>{name(t, locale)}</strong>
            <small>
              {categoryLabel(t.category, locale)} · {t.format}
              {t.source === "community" && t.authorName ? ` · ${t.authorName}` : ""}
            </small>
          </span>
        </button>
      </div>}
      {!isWorkflow && (
        <div className={s.composerSlots}>
          <span className={s.slotOptional}>{c("templates.composer.optional")}</span>
          {slotPlan.length === 0 && images.length === 0 ? (
            <button type="button" className={s.attachBox} onClick={() => openPicker()}>
              <span className={s.attachIcons} aria-hidden="true">
                <i><User size={13} /></i>
                <i><Shirt size={13} /></i>
                <i><Package size={13} /></i>
              </span>
              <strong>{c("templates.attach.title")}</strong>
              <small>{c("templates.attach.limit")}</small>
            </button>
          ) : (
            <div className={s.attachFiles}>
              {slotPlan.map((category, slotIndex) => {
                const image = images.find((item) => item.templateIndex === slotIndex);
                const caption = category ? c(referenceCategoryCopyKeys[category]) : c("templates.attach.imageNumber", { n: slotIndex + 1 });
                if (image) return imageCell(image, caption);
                return (
                  <span key={`slot-${slotIndex}`} className={s.slotCell}>
                    <button type="button" className={`${s.slotAdd} ${s.slotEmpty}`} onClick={() => openPicker(slotIndex)} aria-label={`${c("templates.attach.add")}: ${caption}`}>
                      <Plus size={18} aria-hidden="true" />
                    </button>
                    <em className={s.slotCaption}>{caption}</em>
                  </span>
                );
              })}
              {images.map((image, index) => (image.templateIndex === undefined ? imageCell(image, image.category ? c(referenceCategoryCopyKeys[image.category]) : c("templates.attach.imageNumber", { n: index + 1 })) : null))}
              {images.length + emptySlots < 5 && (
                <button type="button" className={s.slotAdd} onClick={() => openPicker()} aria-label={c("templates.attach.add")}>
                  <Plus size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <ImageAttachmentPicker
            open={pickerOpen}
            limit={Math.max(0, 5 - images.length)}
            onOpenChange={setPickerOpen}
            onPick={(files, categories) => {
              const slot = takeSlotTarget();
              const slotCategory = slot === undefined ? undefined : slotPlan[slot];
              const labeled = slotCategory ? [slotCategory, ...categories.slice(1)] : categories;
              attach(files, labeled, slot);
            }}
          />
          {(attachError || images.some((image) => image.fromTemplate)) && (
            <small className={attachError ? s.sendError : undefined} role={attachError ? "alert" : undefined}>{attachError ?? c("templates.attach.fromTemplate")}</small>
          )}
        </div>
      )}
      <section className={s.composerBlock}>
        <div className={s.composerLabel}>
          <span>{c("templates.composer.prompt")}</span>
          {!free && (
            <button
              type="button"
              role="switch"
              aria-checked={showPrompt}
              aria-label={c("templates.composer.showPrompt")}
              className={s.switchControl}
              onClick={() => setShowPrompt((v) => !v)}
            >
              <i />
            </button>
          )}
        </div>
        {(showPrompt || free) && (
          <textarea
            key={`${t.id}-${locale}`}
            ref={promptRef}
            className={s.composerPrompt}
            defaultValue={promptOf(t, locale)}
            placeholder={c(free ? "templates.composer.freePromptPlaceholder" : "templates.composer.promptPlaceholder")}
            aria-label={c("templates.composer.prompt")}
          />
        )}
      </section>
      {isWorkflow ? (
        <>
          <h3 className={s.workflowStep}>{c("templates.workflow.step1")}</h3>
          <PickerRow
            label={c("templates.preview.factModel")}
            value={flowImageModel ? imagePicker.labelOf(flowImageModel) : c("templates.composer.pickModel")}
            placeholder={!flowImageModel}
            heading={c("templates.composer.featuredModels")}
            searchPlaceholder={c("templates.composer.modelSearch")}
            empty={c("templates.composer.noModels")}
            options={imagePicker.options}
            selectedId={flowImageModel}
            onPick={(id) => setFlow({ ...flow, imageModel: id, imageQuality: "" })}
          />
          <PickerRow
            label={c("templates.composer.quality")}
            value={flow.imageQuality || c("templates.composer.pickQuality")}
            placeholder={!flow.imageQuality}
            heading={c("templates.composer.quality")}
            empty={c("templates.composer.noModels")}
            options={imagePicker.qualitiesOf(flowImageModel).map((id) => ({ id, label: id }))}
            selectedId={flow.imageQuality}
            onPick={(id) => setFlow({ ...flow, imageQuality: id })}
          />
          <h3 className={s.workflowStep}>{c("templates.workflow.step2")}</h3>
          <PickerRow
            label={c("templates.preview.factModel")}
            value={flowVideoModel ? videoPicker.labelOf(flowVideoModel) : c("templates.composer.pickModel")}
            placeholder={!flowVideoModel}
            heading={c("templates.composer.featuredModels")}
            searchPlaceholder={c("templates.composer.modelSearch")}
            empty={c("templates.composer.noModels")}
            options={videoPicker.options}
            selectedId={flowVideoModel}
            onPick={(id) => setFlow({ ...flow, videoModel: id, videoQuality: "" })}
          />
          <PickerRow
            label={c("templates.composer.quality")}
            value={flow.videoQuality || c("templates.composer.pickQuality")}
            placeholder={!flow.videoQuality}
            heading={c("templates.composer.quality")}
            empty={c("templates.composer.noModels")}
            options={videoPicker.qualitiesOf(flowVideoModel).map((id) => ({ id, label: id }))}
            selectedId={flow.videoQuality}
            onPick={(id) => setFlow({ ...flow, videoQuality: id })}
          />
        </>
      ) : (
        <>
      <PickerRow
        label={c("templates.preview.factModel")}
        value={shownModel ? picker.labelOf(shownModel) : c("templates.composer.pickModel")}
        placeholder={!shownModel}
        badge={c("templates.tab.new")}
        note={modelNote}
        heading={c("templates.composer.featuredModels")}
        searchPlaceholder={c("templates.composer.modelSearch")}
        empty={c("templates.composer.noModels")}
        options={modelOptions}
        selectedId={shownModel}
        onPick={(id) => setPicks({ ...picks, templateId: t.id, model: id })}
      />
      <PickerRow
        label={c("templates.composer.quality")}
        value={shownQuality || c("templates.composer.pickQuality")}
        placeholder={!shownQuality}
        note={qualityNote}
        heading={c("templates.composer.quality")}
        empty={c("templates.composer.noModels")}
        options={qualityOptions}
        selectedId={shownQuality}
        onPick={(id) => setPicks({ ...picks, templateId: t.id, quality: id })}
      />
      <PickerRow
        label={c("templates.composer.duration")}
        value={c("templates.preview.seconds", { value: duration })}
        note={durationNote}
        heading={c("templates.composer.duration")}
        empty={c("templates.composer.noModels")}
        options={(picker.durationsOf(shownModel).length ? picker.durationsOf(shownModel) : [5, 10]).map((seconds) => ({ id: String(seconds), label: c("templates.preview.seconds", { value: seconds }) }))}
        selectedId={String(duration)}
        onPick={(id) => setPicks({ ...picks, templateId: t.id, duration: Number(id) })}
      />
        </>
      )}
      {advanced.length > 0 && (
        <details className={s.composerAdvanced} onToggle={(event) => { if (event.currentTarget.open) event.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
          <summary>
            {c("templates.composer.advanced")}
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <dl className={s.composerFacts}>
            {advanced.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <div className={s.composerBar}>
        <div className={s.composerOption}>
          <span>
            {c("templates.composer.freeUse")}
            <em>{c("templates.composer.freeLeft")}</em>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={useFree}
            aria-label={c("templates.composer.freeUse")}
            className={s.switchControl}
            onClick={() => setUseFree((v) => !v)}
          >
            <i />
          </button>
        </div>
        <button type="button" className={s.use} disabled={sending.state === "busy"} onClick={() => void (isWorkflow ? generateWorkflow(t) : generate(t, shownModel, shownQuality))}>
          {sending.state === "busy" ? c("templates.composer.sending") : c("templates.edit.generate")} <Sparkles size={17} />
          {creditText(isWorkflow ? workflowCredits : credits)}
        </button>
        {sending.message && (
          <p role={sending.state === "error" ? "alert" : "status"} className={sending.state === "error" ? s.sendError : undefined}>
            {sending.message}
          </p>
        )}
        <p>{c("templates.composer.chargeNote")}</p>
      </div>
    </aside>
  );
}
