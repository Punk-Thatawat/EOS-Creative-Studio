import { useState } from "react";
import { createPortal } from "react-dom";
import { type HistoryItem } from "@/lib/api/history";
import {
  createAdminTemplate,
  createTemplateCoverFromPreview,
  keepTemplateAssets,
} from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";
import { modeCategory, modeCover, type Mode } from "./library-modes";
import { tidyTitle } from "./template-text";
import { workSlug } from "./saved-works";

/** What the page needs to know about a template just saved from a clip. */
export type SavedTemplate = { slug: string; title: string; coverFailed?: boolean; assetsFailed?: boolean };

export function SaveTemplateDialog({ item, mode, onClose, onCreated }: { item: HistoryItem; mode: Mode; onClose: () => void; onCreated: (saved: SavedTemplate) => void }) {
  const { c } = useStudioCopy();
  const prompt = item.prompt?.trim() ?? "";
  const [title, setTitle] = useState(tidyTitle(prompt || item.title, 80));
  const [description, setDescription] = useState(prompt.slice(0, 240));
  const [category, setCategory] = useState(modeCategory[mode]);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const save = async () => {
    if (!title.trim()) return setState({ busy: false, error: c("templates.save.needTitle") });
    setState({ busy: true });
    try {
      const tab = ["image-to-video", "text-to-video", "people-video", "motion-transfer", "video-swap", "lipsync", "extend-video"].includes(item.feature) ? item.feature : "text-to-video";
      const slug = workSlug(item.id);
      const created = await createAdminTemplate({
        slug,
        title: title.trim().slice(0, 80),
        description: (description.trim() || title.trim()).slice(0, 240),
        category: category.trim().slice(0, 40) || modeCategory[mode],
        kind: "video",
        // Saved from a member's own clip, so it is listed with the community's templates.
        source: "community",
        format: "Video",
        // A stand-in until the server has cut the real cover from the clip below.
        thumbnailUrl: modeCover[mode],
        previewUrl: item.outputUrl ?? "",
        targetPath: `/create/video?tab=${tab === "video-swap" ? "motion-transfer" : tab}&template=${slug}`,
        prompt,
        tags: [],
        featured: false,
        enabled: true,
        sortOrder: 0,
        settings: { ...Object.fromEntries(Object.entries(item.settings ?? {}).filter(([key]) => key !== "templateSlug")), feature: tab },
      });
      // The cover is a frame of the clip, cut and kept by the server. If that fails the template still exists, with the stand-in.
      const coverFailed = await createTemplateCoverFromPreview(created.id).then(() => false).catch(() => true);
      // The images and the clip it started from are provider links that expire in a week; the server keeps copies.
      const assetsFailed = await keepTemplateAssets(created.id).then(() => false).catch(() => true);
      onCreated({ slug, title: title.trim(), coverFailed, assetsFailed });
      onClose();
    } catch (error) {
      // A clip that was already saved once: the template exists, so treat it as saved rather than as a failure.
      if (error instanceof Error && /slug already exists/i.test(error.message)) {
        onCreated({ slug: workSlug(item.id), title: title.trim() });
        onClose();
        return;
      }
      setState({ busy: false, error: error instanceof Error ? error.message : c("templates.save.failed") });
    }
  };
  return createPortal(
    <div className={s.saveBackdrop} role="presentation" onClick={onClose}>
      <div className={s.saveDialog} role="dialog" aria-modal="true" aria-label={c("templates.save.title")} onClick={(event) => event.stopPropagation()}>
        <h2>{c("templates.save.title")}</h2>
        <video src={item.outputUrl} muted playsInline preload="metadata" />
        <label>
          {c("templates.save.name")}
          <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          {c("templates.save.description")}
          <textarea value={description} maxLength={240} rows={3} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label>
          {c("templates.save.category")}
          <input value={category} maxLength={40} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <p>{c("templates.save.coverAuto")}</p>
        {!prompt && <p>{c("templates.save.noPrompt")}</p>}
        <p>{c("templates.save.publicNote")}</p>
        {state.error && <p role="alert" className={s.sendError}>{state.error}</p>}
        <div>
          <button type="button" onClick={onClose}>{c("templates.save.cancel")}</button>
          <button type="button" className={s.saveConfirm} disabled={state.busy} onClick={() => void save()}>
            {state.busy ? c("templates.composer.sending") : c("templates.save.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
