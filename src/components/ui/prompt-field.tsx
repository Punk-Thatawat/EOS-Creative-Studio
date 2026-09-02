import { cn } from "@/lib/utils";
import type { ChangeEvent, ReactNode } from "react";

export type PromptFieldProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  wrapperClassName?: string;
  fieldClassName?: string;
  afterField?: ReactNode;
  metaClassName?: string;
};

export function PromptField({
  value,
  onChange,
  id,
  placeholder,
  ariaLabel,
  required = false,
  multiline = true,
  maxLength = 2000,
  wrapperClassName,
  fieldClassName,
  afterField,
  metaClassName,
}: PromptFieldProps) {
  const fieldProps = {
    id,
    value,
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => onChange(event.target.value),
    placeholder,
    "aria-label": ariaLabel,
    maxLength,
    required,
    "aria-required": required,
    className: fieldClassName,
  };

  return <>
    <label className={cn("block", wrapperClassName)}>
      {multiline ? <textarea {...fieldProps} /> : <input {...fieldProps} type="text" />}
    </label>
    {afterField}
    <div className={cn("mt-1 flex items-center justify-between gap-2 text-[9px] text-[#8c8d91]", metaClassName)}>
      <span>Maximum {maxLength.toLocaleString()} characters</span>
      <span>{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
  </>;
}
