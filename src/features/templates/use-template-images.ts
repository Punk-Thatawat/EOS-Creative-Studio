import { useEffect, useRef, useState } from "react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { referenceCategoryOf, type ReferenceCategory } from "./template-references";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import { valid } from "./template-text";

/** The images a template starts from, in the order its maker used them. */
export function inputImagesOf(t?: Template): string[] {
  const settings = t?.settings ?? {};
  const list = Array.isArray(settings.inputImages) ? settings.inputImages : Array.isArray(settings.sourceImages) ? settings.sourceImages : [];
  const single = typeof settings.sourceImage === "string" ? [settings.sourceImage] : [];
  return [...new Set([...list, ...single].filter((address): address is string => typeof address === "string" && valid(address)))].slice(0, 5);
}

/** The clip a motion or swap template works from: the one its maker used, else the template's own clip. */
export function referenceVideoOf(t?: Template): string | undefined {
  const own = t?.settings?.sourceVideo;
  if (typeof own === "string" && valid(own)) return own;
  // A video-edit template's preview is the result, not the source to edit.
  if (t?.settings?.feature === "video-swap" || t?.settings?.variant === "swap") return undefined;
  return t && valid(t.previewUrl) ? t.previewUrl : undefined;
}

/** Which of the two motion-mode tools a template was made with. */
export const variantOf = (t?: Template): "motion" | "swap" => (t?.settings?.feature === "video-swap" || t?.settings?.variant === "swap" ? "swap" : "motion");

/**
 * Reads the input images of a template as files, to send again like the visitor's own: the kept ones on this site and the
 * creator's storage links (both can be read from the page). What cannot be read (an expired link) is left out.
 */
async function loadInputFiles(addresses: string[]): Promise<(File | null)[]> {
  const files = await Promise.all(
    addresses.map(async (address, index) => {
      try {
        const response = await fetch(address);
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) return null;
        return new File([blob], `template-image-${index + 1}.${blob.type === "image/jpeg" ? "jpg" : blob.type.slice(6)}`, { type: blob.type });
      } catch {
        return null;
      }
    }),
  );
  return files;
}

/**
 * The images attached to a panel, up to a limit. A template that has its own input images puts them here when it is opened
 * (and takes them away again when another one is), while the visitor's own images stay.
 */
export function useTemplateImages(t: Template | undefined, limit: number, enabled: boolean, fixedSlots = false) {
  const { c } = useStudioCopy();
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [readyKey, setReadyKey] = useState("");
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)), []);
  const addresses = enabled ? inputImagesOf(t).join("\n") : "";
  const categoryKey = enabled ? JSON.stringify(t?.settings?.inputImageCategories ?? {}) : "{}";
  const requestKey = JSON.stringify([addresses, limit, enabled, fixedSlots, categoryKey]);
  const loadError = c("templates.attach.templateLoadFailed");
  useEffect(() => {
    let alive = true;
    void loadInputFiles(addresses ? addresses.split("\n") : []).then((files) => {
      if (!alive) return;
      const before = imagesRef.current;
      const own = before.filter((image) => !image.fromTemplate);
      before.filter((image) => image.fromTemplate).forEach((image) => URL.revokeObjectURL(image.url));
      if (files.some((file) => file === null)) {
        imagesRef.current = own;
        setImages(own);
        setError(loadError);
        setReadyKey(requestKey);
        return;
      }
      const loaded = files.filter((file): file is File => file !== null).slice(0, Math.max(0, limit - own.length)).map((file, index) => {
        const category = referenceCategoryOf({ inputImageCategories: JSON.parse(categoryKey) as unknown }, addresses.split("\n")[index] ?? "");
        return { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), fromTemplate: true, templateIndex: index, ...(category ? { category } : {}), ...(fixedSlots ? { slot: index } : {}) };
      });
      // Template references precede images added by the visitor, matching @Image numbering.
      const next = [...loaded, ...own];
      imagesRef.current = next;
      setImages(next);
      setError(undefined);
      setReadyKey(requestKey);
    });
    return () => {
      alive = false;
    };
  }, [addresses, categoryKey, limit, loadError, requestKey, fixedSlots]);
  const attach = (files: File[], categories: Array<ReferenceCategory | undefined> = [], templateIndex?: number) => {
    // A panel that takes one image swaps it for the new one.
    const current = imagesRef.current;
    const next = limit === 1 && !fixedSlots ? [] : [...current];
    let problem: string | undefined;
    // The first image goes to the box that was asked for, if that box is free.
    let target = templateIndex !== undefined && !next.some((image) => image.templateIndex === templateIndex) ? templateIndex : undefined;
    for (const [index, file] of files.entries()) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        problem = c("templates.attach.unsupported");
        continue;
      }
      if (next.length >= limit) {
        problem = fixedSlots ? c("templates.motion.referenceLimit", { count: limit }) : c("templates.attach.tooMany");
        break;
      }
      const slot = fixedSlots ? Array.from({ length: limit }, (_, index) => index).find((index) => !next.some((image) => image.slot === index)) : undefined;
      const category = categories[index];
      next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), ...(category ? { category } : {}), ...(slot !== undefined ? { slot } : {}), ...(target !== undefined ? { templateIndex: target } : {}) });
      target = undefined;
    }
    if (fixedSlots) next.sort((a, b) => (a.slot ?? limit) - (b.slot ?? limit));
    // The images follow the order of the boxes, so "@Image 1, 2" keep meaning the same thing.
    else if (next.some((image) => image.templateIndex !== undefined)) next.sort((a, b) => (a.templateIndex ?? 99) - (b.templateIndex ?? 99));
    current.filter((image) => !next.includes(image)).forEach((image) => URL.revokeObjectURL(image.url));
    imagesRef.current = next;
    setImages(next);
    setError(problem);
  };
  const detach = (id: string) => {
    const gone = imagesRef.current.find((image) => image.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    const next = imagesRef.current.filter((image) => image.id !== id);
    imagesRef.current = next;
    setImages(next);
    setError(undefined);
  };
  const replace = (id: string, file: File | undefined, category?: ReferenceCategory) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(c("templates.attach.unsupported"));
      return;
    }
    const current = imagesRef.current;
    const index = current.findIndex((image) => image.id === id);
    if (index < 0) return;
    const previous = current[index]!;
    const next = [...current];
    next[index] = { id: crypto.randomUUID(), file, url: URL.createObjectURL(file), ...(previous.slot !== undefined ? { slot: previous.slot } : {}), ...(category ? { category } : {}) };
    URL.revokeObjectURL(previous.url);
    imagesRef.current = next;
    setImages(next);
    setError(undefined);
  };
  return { images, attach, detach, replace, error, loading: readyKey !== requestKey };
}

/**
 * The control column, laid out like a creation panel: type tabs, the chosen template as a card, its prompt, the model and
 * quality rows, the rest of the settings folded under "Advanced", and the button that opens it in the creator.
 */
/** An image attached in the optional card, with its preview address. */
export type AttachedImage = { id: string; file: File; url: string; /** Put there by a template, not picked by the visitor. */ fromTemplate?: boolean; slot?: number; /** What the template says this image is: a character, a product or other. */ category?: ReferenceCategory; /** The box of the template this image fills. The box stays, with its label, when the image is taken out. */ templateIndex?: number };
