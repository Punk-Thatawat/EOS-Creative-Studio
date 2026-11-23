import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Search, Sparkles } from "lucide-react";
import s from "./templates-page.module.css";
import { type FlyoutOption } from "./edit-workspace";

/**
 * A row (label, value, chevron) that opens a floating list to the right of the panel, like the model and quality pickers of
 * a creation panel: an optional search box, a heading, the choices with a tick on the chosen one.
 */
export function PickerRow({
  label,
  value,
  placeholder,
  badge,
  note,
  heading,
  searchPlaceholder,
  empty,
  options,
  selectedId,
  onPick,
}: {
  label: string;
  value: string;
  /** The value is only a prompt to choose, so it is shown dimmed. */
  placeholder?: boolean;
  /** The small tag after the value (and its icon), for example "New". */
  badge?: string;
  /** Said after the label, for example that the value is the one the template sets. */
  note?: string;
  heading: string;
  /** When given, the list has a search box. */
  searchPlaceholder?: string;
  empty: string;
  options: FlyoutOption[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [query, setQuery] = useState("");
  const isOpen = anchor !== null;
  const place = useCallback(() => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // On a phone the sticky header and the tab bar stay visible, so the list sits between them.
    const phone = window.innerWidth < 768;
    const topEdge = phone ? 76 : 12;
    const bottomEdge = phone ? 84 : 12;
    let maxHeight = Math.min(460, window.innerHeight - topEdge - bottomEdge);
    // To the right of the panel, level with the row but kept inside the window.
    let top = Math.max(topEdge, Math.min(rect.top - (searchPlaceholder ? 120 : 40), window.innerHeight - maxHeight - bottomEdge));
    if (phone) {
      // Under the row it belongs to, so the row stays visible; above it when there is more room there.
      const below = window.innerHeight - bottomEdge - rect.bottom - 6;
      const above = rect.top - topEdge - 6;
      if (below >= Math.min(300, above)) {
        maxHeight = Math.min(maxHeight, below);
        top = rect.bottom + 6;
      } else {
        maxHeight = Math.min(maxHeight, above);
        top = rect.top - 6 - maxHeight;
      }
    }
    // On a phone there is no room beside the panel, so the list is kept inside the window instead.
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right + 10, window.innerWidth - width - 12));
    return { top, left, maxHeight };
  }, [searchPlaceholder]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setAnchor(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // The list is fixed on the screen, so when the page scrolls under it, it is put back beside its row.
    const follow = (event: Event) => {
      if (flyRef.current?.contains(event.target as Node)) return;
      const next = place();
      if (next) setAnchor(next);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", follow, true);
    };
  }, [isOpen, place]);

  const open = () => {
    const next = place();
    if (!next) return;
    setQuery("");
    setAnchor(next);
  };
  const needle = query.trim().toLowerCase();
  const listed = options.filter((o) => !needle || o.label.toLowerCase().includes(needle));
  const list: ReactNode = (
    <ul>
      {listed.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            aria-current={o.id === selectedId ? "true" : undefined}
            onClick={() => {
              onPick(o.id);
              setAnchor(null);
            }}
          >
            <span className={s.flyCopy}>
              <strong>
                <span>{o.label}</span>
                {o.badge && <em>{o.badge}</em>}
              </strong>
              {o.chips && o.chips.length > 0 && (
                <small>
                  {o.chips.map((chip) => (
                    <i key={chip}>{chip}</i>
                  ))}
                </small>
              )}
            </span>
            {o.id === selectedId && <Check size={16} aria-hidden="true" />}
          </button>
        </li>
      ))}
      {listed.length === 0 && <li className={s.flyEmpty}>{empty}</li>}
    </ul>
  );
  return (
    <>
      <button ref={rowRef} type="button" className={s.composerRow} aria-expanded={anchor !== null} onClick={open}>
        <span>
          <small>
            {label}
            {note && <i className={s.rowNote}>{note}</i>}
          </small>
          <strong>
            <span className={`${s.rowValue} ${placeholder ? s.rowPlaceholder : ""}`}>{value}</span>
            {badge && (
              <>
                <Sparkles size={13} aria-hidden="true" />
                <em>{badge}</em>
              </>
            )}
          </strong>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {anchor &&
        createPortal(
          <>
            <button type="button" className={s.flyBackdrop} aria-label={heading} onClick={() => setAnchor(null)} />
            <div ref={flyRef} className={s.flyout} style={{ top: anchor.top, left: anchor.left, maxHeight: anchor.maxHeight }}>
              {searchPlaceholder && (
                <label className={s.flySearch}>
                  <Search size={16} aria-hidden="true" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} autoFocus />
                </label>
              )}
              <span className={s.flyHeading}>{heading}</span>
              {list}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
