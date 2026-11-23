import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, User, WandSparkles, X } from "lucide-react";
import { uploadImageAsset } from "@/lib/api/storage";
import { listStylePresets } from "@/lib/api/style-presets";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import {
  readCustomStyles,
  saveCustomStyles,
  styleNameFromFile,
  type StyleChoice,
} from "./custom-styles";

/** "Styles": pick a look for the video, or upload your own image to take the look from. */
export function StylesPanel({ chosen, onPick }: { chosen: StyleChoice | null; onPick: (style: StyleChoice) => void }) {
  const { c } = useStudioCopy();
  const [source, setSource] = useState<"eos" | "custom">("eos");
  const [eos, setEos] = useState<StyleChoice[]>([]);
  // Read after mount (the server render has no storage), so a custom style never causes a hydration mismatch.
  const [custom, setCustom] = useState<StyleChoice[]>([]);
  const [customRead, setCustomRead] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    listStylePresets()
      .then((list) => {
        if (alive) setEos(list.filter((preset) => preset.enabled && preset.imageUrl).map((preset) => ({ id: preset.id, name: preset.name, imageUrl: preset.imageUrl ?? "" })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const upload = async (file: File) => {
    setState({ busy: true });
    try {
      const imageUrl = await uploadImageAsset(file, { purpose: "style-reference", feature: "text-to-video" });
      const style: StyleChoice = { id: crypto.randomUUID(), name: styleNameFromFile(file.name, c("templates.styles.untitled")), imageUrl };
      const next = [style, ...custom];
      setCustom(next);
      saveCustomStyles(next);
      onPick(style);
      setState({ busy: false });
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : c("templates.styles.uploadFailed") });
    }
  };
  const remove = (id: string) => {
    const next = custom.filter((style) => style.id !== id);
    setCustom(next);
    saveCustomStyles(next);
  };
  if (source === "custom" && !customRead) {
    setCustomRead(true);
    setCustom(readCustomStyles());
  }
  const shown = source === "eos" ? eos : custom;
  const cover = eos[0]?.imageUrl ?? custom[0]?.imageUrl;
  return (
    <section>
      <div className={s.libraryHero}>
        <div className={s.libraryHeroCopy}>
          <h1>{c("templates.styles.heading")}</h1>
          <p>{c("templates.styles.body")}</p>
        </div>
        {cover && (
          <div className={s.libraryHeroCover}>
            <span className={s.heroCoverMain} style={{ flexBasis: "100%" }}>
              <Image src={cover} alt="" fill unoptimized sizes="470px" className={s.poster} />
            </span>
          </div>
        )}
      </div>
      <section className={s.toolbar} aria-label={c("templates.styles.sourceAria")}>
        <div className={s.tabs}>
          <button type="button" aria-pressed={source === "eos"} onClick={() => setSource("eos")}>
            <WandSparkles size={14} aria-hidden="true" />
            {c("templates.sortEos")}
          </button>
          <button type="button" aria-pressed={source === "custom"} onClick={() => setSource("custom")}>
            <User size={14} aria-hidden="true" />
            {c("templates.styles.custom")}
          </button>
        </div>
      </section>
      <div className={s.styleGrid}>
        {source === "custom" && (
          <>
            <button type="button" className={s.styleUpload} disabled={state.busy} onClick={() => inputRef.current?.click()}>
              <ImagePlus size={26} aria-hidden="true" />
              <strong>{state.busy ? c("templates.composer.sending") : c("templates.styles.upload")}</strong>
              <small>{c("templates.styles.uploadHint")}</small>
              {state.error && <em role="alert">{state.error}</em>}
            </button>
            <input
              ref={inputRef}
              className={s.visuallyHidden}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </>
        )}
        {shown.map((style) => (
          <div key={style.id} className={`${s.styleCard} ${chosen?.id === style.id ? s.styleCardChosen : ""}`}>
            <button type="button" aria-pressed={chosen?.id === style.id} onClick={() => onPick(style)} aria-label={style.name}>
              <Image src={style.imageUrl} alt="" fill unoptimized sizes="400px" className={s.poster} />
              <span>{style.name}</span>
              {chosen?.id === style.id && <Check size={16} aria-hidden="true" />}
            </button>
            {source === "custom" && (
              <button type="button" className={s.styleRemove} aria-label={c("templates.styles.remove")} onClick={() => remove(style.id)}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {source === "eos" && shown.length === 0 && <p className={s.empty}>{c("templates.styles.none")}</p>}
    </section>
  );
}
