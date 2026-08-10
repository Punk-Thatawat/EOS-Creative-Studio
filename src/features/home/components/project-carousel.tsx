"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProjectCarousel({ children, className = "" }: { children: ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);

    return () => window.removeEventListener("resize", updateScrollState);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollBy({
      behavior: "smooth",
      left: direction === "right" ? element.clientWidth * 0.8 : -(element.clientWidth * 0.8),
    });
  };

  return <div className="relative"><div ref={scrollRef} onScroll={updateScrollState} className={`flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-none ${className}`}>{children}</div>{canScrollLeft ? <button type="button" onClick={() => scroll("left")} className="absolute left-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-[var(--shadow-md)] transition hover:border-primary hover:text-primary" aria-label="Previous projects"><ChevronLeft size={20} /></button> : null}{canScrollRight ? <button type="button" onClick={() => scroll("right")} className="absolute right-5 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-[var(--shadow-md)] transition hover:border-primary hover:text-primary" aria-label="Next projects"><ChevronRight size={20} /></button> : null}</div>;
}
