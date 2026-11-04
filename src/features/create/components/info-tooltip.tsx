"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./info-tooltip.module.css";

type InfoTooltipProps = {
  content: string;
  size?: number;
  side?: "top" | "bottom" | "left" | "right";
};

export function InfoTooltip({ content, size = 12, side = "top" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        delay={150}
        closeOnClick={false}
        onClick={() => setOpen((current) => !current)}
        render={
          <button type="button" className={styles.trigger} data-info-tooltip aria-label={content}>
            <Info size={size} aria-hidden="true" />
          </button>
        }
      />
      <TooltipContent side={side} className={styles.content}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
