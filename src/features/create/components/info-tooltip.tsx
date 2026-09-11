"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./info-tooltip.module.css";

type InfoTooltipProps = {
  content: string;
  size?: number;
  side?: "top" | "bottom" | "left" | "right";
};

export function InfoTooltip({ content, size = 12, side = "top" }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className={styles.trigger} aria-label={content}>
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
