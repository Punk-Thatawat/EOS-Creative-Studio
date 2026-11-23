import { useState } from "react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";
import { useStudioCopy } from "@/lib/i18n/studio-copy";
import Image from "next/image";
import s from "./templates-page.module.css";
import { heroKeys, type Mode } from "./library-modes";
import { valid } from "./template-text";

/** The head of the library: a large title and one line of copy, with one featured cover on the right. */
export function LibraryHero({ mode, items }: { mode: Mode; items: Template[] }) {
  const { c } = useStudioCopy();
  const hero = heroKeys[mode];
  // Some covers fail to load; move on to the next one rather than leave the space empty.
  const [skipped, setSkipped] = useState(0);
  const covers = items.filter((t) => valid(t.thumbnailUrl)).slice(skipped, skipped + 2);
  const cover = covers[0];
  return (
    <div className={s.libraryHero}>
      <div className={s.libraryHeroCopy}>
        <h1>{c(hero.title)}</h1>
        <p>{c(hero.body)}</p>
      </div>
      {cover && (
        <div className={s.libraryHeroCover}>
          {covers.map((item, i) => (
            <span key={item.id} className={i === 0 ? s.heroCoverMain : s.heroCoverSide}>
              <Image
                src={item.thumbnailUrl}
                alt=""
                fill
                unoptimized
                sizes="470px"
                className={s.poster}
                onError={i === 0 ? () => setSkipped((n) => n + 1) : undefined}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
