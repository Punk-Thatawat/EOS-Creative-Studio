"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import s from "./templates-page.module.css";

/**
 * A row of category chips that can be scrolled sideways: with the arrows at its ends (shown only when there is more to see),
 * a trackpad or touch swipe, or Shift + the mouse wheel.
 */
export function CategoryChips({
  names,
  active,
  onSelect,
  labelOf,
  ariaLabel,
  scrollLeftLabel,
  scrollRightLabel,
}: {
  names: string[];
  active: string;
  onSelect: (name: string) => void;
  labelOf: (name: string) => string;
  ariaLabel: string;
  scrollLeftLabel: string;
  scrollRightLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const left = list.scrollLeft > 2;
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 2;
    setEdge((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);
  // Observing reports the first size at once, so this also measures when the chips change.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, names]);
  const scrollBy = (direction: -1 | 1) => {
    const list = listRef.current;
    if (list) list.scrollBy({ left: direction * Math.max(160, list.clientWidth * 0.7), behavior: "smooth" });
  };
  return (
    <div className={s.categoryRow}>
      {edge.left && (
        <button type="button" className={`${s.categoryArrow} ${s.categoryArrowLeft}`} aria-label={scrollLeftLabel} onClick={() => scrollBy(-1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      )}
      <div ref={listRef} className={s.categoryChips} role="group" aria-label={ariaLabel} onScroll={measure}>
        {names.map((name) => (
          <button key={name} type="button" aria-pressed={active === name} onClick={() => onSelect(name)}>
            {labelOf(name)}
          </button>
        ))}
      </div>
      {edge.right && (
        <button type="button" className={`${s.categoryArrow} ${s.categoryArrowRight}`} aria-label={scrollRightLabel} onClick={() => scrollBy(1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
