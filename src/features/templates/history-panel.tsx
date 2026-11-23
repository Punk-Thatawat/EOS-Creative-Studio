import { ImagePlus, PanelsTopLeft, Sparkles, Video, Upload } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import s from "./templates-page.module.css";
import { modeCover, stepsByMode, type Mode } from "./library-modes";
import { valid } from "./template-text";
import { Tile } from "./template-media";
import { MyVideos } from "./my-videos";

/** "History": what was opened from here lately; before anything was, an invitation with the three steps. */
export function HistoryPanel({
  mode,
  recent,
  items,
  onSelect,
  onExpand,
  savedSlugs,
  onUseSaved,
  onOpenSaved,
  onTemplateCreated,
  onRecreate,
  onClearRecent,
}: {
  mode: Mode;
  recent: Template[];
  /** Empties the list of templates opened lately. */
  onClearRecent: () => void;
  items: Template[];
  onSelect: (t: Template) => void;
  onExpand: (t: Template) => void;
  onRecreate?: (t: Template) => void;
  /** Absent when this mode has no library to open. */
  /** The addresses of the templates in the library. */
  savedSlugs: Set<string>;
  /** Puts a saved template on the left panel, ready to use. */
  onUseSaved: (slug: string) => void;
  /** Opens the community's list, where a clip just saved as a template is. */
  onOpenSaved: () => void;
  /** Called after a finished video was saved as a template, so the library can reload. */
  onTemplateCreated: (saved: { slug: string; title: string }) => void;
}) {
  const { c } = useStudioCopy();
  const own = items.filter((t) => valid(t.thumbnailUrl));
  // With no template in the library yet, the pictures of the three steps are the stock covers, so the steps are never left empty.
  const covers: Array<{ id: string; thumbnailUrl: string }> = own.length ? own : [modeCover.create, modeCover.edit, modeCover.motion].map((thumbnailUrl) => ({ id: thumbnailUrl, thumbnailUrl }));
  const steps = stepsByMode[mode];
  if (recent.length)
    return (
      <>
        <MyVideos mode={mode} savedSlugs={savedSlugs} onTemplateCreated={onTemplateCreated} onUseSaved={onUseSaved} onOpenLibrary={mode === "edit" ? undefined : onOpenSaved} onDetails={onExpand} />
        <section>
          <div className={s.libraryTitle}>
            <h2>{c("templates.history.recent")}</h2>
            <button type="button" className={s.clearRecent} onClick={onClearRecent}>{c("templates.history.clearRecent")}</button>
          </div>
          <div className={s.masonry}>
            {recent.map((t) => (
              <Tile key={t.id} t={t} selected={false} onSelect={onSelect} onExpand={onExpand} onRecreate={onRecreate} />
            ))}
          </div>
        </section>
      </>
    );
  return (
    <>
    <MyVideos mode={mode} savedSlugs={savedSlugs} onTemplateCreated={onTemplateCreated} onUseSaved={onUseSaved} onOpenLibrary={mode === "edit" ? undefined : onOpenSaved} onDetails={onExpand} />
    <section className={`${s.invite} ${mode === "motion" ? s.motionInvite : ""}`}>
      <h2>{c("templates.history.heading")}</h2>
      <p>{c("templates.history.body")}</p>
      <ol className={s.inviteSteps}>
        {steps.map(([title, body], i) => (
          <li key={title}>
            <div className={`${s.inviteArt} ${s[`inviteArt${i + 1}`]}`} aria-hidden="true">
              {mode === "motion" ? (
                i === 1 && covers[0] ? (
                  <span className={s.motionInviteImage} style={{ backgroundImage: `url("${covers[0].thumbnailUrl}")` }} />
                ) : (
                  <span className={s.motionInviteIcon}>
                    {i === 0 ? <Video size={28} /> : i === 1 ? <ImagePlus size={28} /> : <Sparkles size={28} />}
                  </span>
                )
              ) : i === 0 ? (
                <div className={s.uploadDemo}>
                  <Upload size={28} aria-hidden="true" />
                  <strong>{c(title).toUpperCase()}</strong>
                  <small>{c(body)}</small>
                  {covers[0] && <span style={{ backgroundImage: `url("${covers[0].thumbnailUrl}")` }} />}
                </div>
              ) : i === 1 ? (
                <div className={s.presetDemo}>
                  {covers.slice(0, 4).map((t, index) => (
                    <span key={t.id} className={index === 1 ? s.presetSelected : ""} style={{ backgroundImage: `url("${t.thumbnailUrl}")` }} />
                  ))}
                </div>
              ) : covers[i] ? (
                <span className={s.resultDemo} style={{ backgroundImage: `url("${covers[i].thumbnailUrl}")` }} />
              ) : (
                <PanelsTopLeft size={30} aria-hidden="true" />
              )}
            </div>
            <h3>{c(title)}</h3>
            <p>{c(body)}</p>
          </li>
        ))}
      </ol>
    </section>
    </>
  );
}
