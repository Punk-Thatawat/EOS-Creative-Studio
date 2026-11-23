import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import { stepsByMode, type Mode } from "./library-modes";
import { name, valid } from "./template-text";

export function HowItWorks({ mode, items, onSelect }: { mode: Mode; items: Template[]; onSelect?: (t: Template) => void }) {
  const { c, locale } = useStudioCopy();
  const [step, setStep] = useState(0);
  const steps = stepsByMode[mode];
  const covers = items.filter((t) => valid(t.thumbnailUrl));
  // A cover that fails to load is skipped, so the big picture is never an empty box.
  const [skip, setSkip] = useState(0);
  const cover = (i: number) => covers[(i + skip) % Math.max(covers.length, 1)]?.thumbnailUrl;
  const go = (delta: number) => setStep((v) => (v + delta + steps.length) % steps.length);
  if (mode === "motion") {
    const motionItems = items.filter((item) => item.kind === "video" && valid(item.thumbnailUrl));
    return (
      <section className={s.motionHow}>
        <section className={s.motionLibrary}>
          <h2>{c("templates.motion.library.heading")}</h2>
          {motionItems.length ? <div className={s.motionGallery}>
            {motionItems.map((item) => <button key={item.id} type="button" onClick={() => onSelect?.(item)} aria-label={name(item, locale)} title={name(item, locale)}>
              {/* The motion plays on the tile itself (muted, looping), like the reference clips of a motion library. */}
              {valid(item.previewUrl) ? (
                <video src={item.previewUrl} poster={valid(item.thumbnailUrl) ? item.thumbnailUrl : undefined} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
              ) : (
                <Image src={item.thumbnailUrl} alt="" fill unoptimized sizes="(max-width: 800px) 40vw, 240px" className={s.poster} />
              )}
            </button>)}
          </div> : <p className={s.motionLibraryEmpty}>{c("templates.motion.library.empty")}</p>}
        </section>
      </section>
    );
  }
  return (
    <section className={s.how}>
      <div className={s.howStage} aria-hidden="true">
        {cover(step) && (
          <Image
            key={cover(step)}
            src={cover(step)}
            alt=""
            fill
            unoptimized
            sizes="560px"
            className={s.poster}
            onError={() => setSkip((n) => (n + 1 < covers.length ? n + 1 : n))}
          />
        )}
      </div>
      <span className={s.howEyebrow}>{c("templates.how.eyebrow")}</span>
      <h2>{c(steps[step][0])}</h2>
      <p>{c(steps[step][1])}</p>
      <div className={s.howControls}>
        <button type="button" onClick={() => go(-1)} aria-label={c("templates.how.prev")}>
          <ChevronLeft size={16} />
        </button>
        <div className={s.howThumbs}>
          {steps.map(([title], i) => (
            <button
              key={title}
              type="button"
              aria-current={i === step ? "step" : undefined}
              aria-label={c(title)}
              onClick={() => setStep(i)}
              style={cover(i) ? { backgroundImage: `url("${cover(i)}")` } : undefined}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label={c("templates.how.next")}>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
