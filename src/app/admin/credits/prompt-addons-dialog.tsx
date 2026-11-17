import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PricingRow, type PromptAddonEntry } from "./pricing.types";
import { rowKey } from "./pricing-rows";
import { promptAddonEntries } from "./prompt-addons";

export function PromptAddonsDialog({
  row,
  value,
  onApply,
  onClose,
}: {
  row: PricingRow;
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const parsedInitially = useMemo(() => {
    try {
      return { entries: promptAddonEntries(value), error: "" };
    } catch (reason) {
      return {
        entries: [],
        error:
          reason instanceof Error
            ? reason.message
            : "Invalid prompt add-ons configuration",
      };
    }
  }, [value]);
  const [entries, setEntries] = useState<PromptAddonEntry[]>(
    parsedInitially.entries,
  );
  const [error, setError] = useState(parsedInitially.error);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateEntry = (
    entryIndex: number,
    patch: Partial<PromptAddonEntry>,
  ) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex ? { ...entry, ...patch } : entry,
      ),
    );
    setError("");
  };

  const updateOption = (
    entryIndex: number,
    optionIndex: number,
    patch: Partial<PromptAddonEntry["values"][number]>,
  ) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: entry.values.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex
                  ? { ...option, ...patch }
                  : option,
              ),
            }
          : entry,
      ),
    );
    setError("");
  };

  const addVariable = () => {
    setEntries((current) => [
      ...current,
      { key: "", values: [{ option: "", amount: "" }] },
    ]);
    setError("");
  };

  const addOption = (entryIndex: number) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: [...entry.values, { option: "", amount: "" }],
            }
          : entry,
      ),
    );
  };

  const removeVariable = (entryIndex: number) => {
    setEntries((current) => current.filter((_, index) => index !== entryIndex));
  };

  const removeOption = (entryIndex: number, optionIndex: number) => {
    setEntries((current) =>
      current.map((entry, index) =>
        index === entryIndex
          ? {
              ...entry,
              values: entry.values.filter(
                (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
              ),
            }
          : entry,
      ),
    );
  };

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result: Record<string, Record<string, number>> = {};
    const variableKeys = new Set<string>();

    for (const [entryIndex, entry] of entries.entries()) {
      const key = entry.key.trim();
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) {
        setError(
          `Variable ${entryIndex + 1}: use snake_case, e.g. quality or aspect_ratio`,
        );
        return;
      }
      if (key === "output_format" || key === "outputFormat") {
        setError("output_format is controlled by the provider and cannot be an add-on");
        return;
      }
      if (variableKeys.has(key)) {
        setError(`Duplicate variable: ${key}`);
        return;
      }
      variableKeys.add(key);

      const options: Record<string, number> = {};
      for (const [optionIndex, item] of entry.values.entries()) {
        const option = item.option.trim();
        const amount = Number(item.amount);
        if (!option) {
          setError(`Variable ${key}: option ${optionIndex + 1} is required`);
          return;
        }
        if (Object.prototype.hasOwnProperty.call(options, option)) {
          setError(`Variable ${key}: duplicate option ${option}`);
          return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
          setError(`Variable ${key}: amount for ${option} must be 0 or greater`);
          return;
        }
        options[option] = amount;
      }
      if (Object.keys(options).length === 0) {
        setError(`Variable ${key}: add at least one option`);
        return;
      }
      result[key] = options;
    }

    onApply(JSON.stringify(result, null, 2));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201d1b]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rowKey(row)}-addons-title`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={apply}
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-[#fffaf7] p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e9] text-primary">
              <Plus size={19} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                Prompt price add-ons
              </p>
              <h3
                id={`${rowKey(row)}-addons-title`}
                className="mt-1 text-base font-bold"
              >
                {row.displayName} · Add pricing options
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                เพิ่มค่าบริการตามค่าที่พิมพ์ใน prompt เฉพาะกรณีที่ model ไม่มี
                parameter นี้ใน schema
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-foreground"
            aria-label={`Close prompt add-ons for ${row.model}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#eaded6] bg-white p-3 text-[11px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 shrink-0 text-primary" size={14} />
          <p>
            จำนวนเงินเป็น <strong className="text-foreground">THB / image</strong>
            . ถ้า model รองรับ parameter อยู่แล้ว ระบบจะไม่คิด add-on ซ้ำ
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#f1c5b5] bg-[#fff5f1] px-3 py-2 text-xs font-semibold text-[#a94725]" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {entries.map((entry, entryIndex) => (
            <section
              key={`addon-entry-${entryIndex}`}
              className="rounded-2xl border border-border bg-white p-3 sm:p-4"
            >
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-semibold">
                  <span className="mb-1.5 block">
                    Variable {entryIndex + 1}
                  </span>
                  <input
                    value={entry.key}
                    onChange={(event) =>
                      updateEntry(entryIndex, { key: event.target.value })
                    }
                    placeholder="quality"
                    list={`${rowKey(row)}-addon-variables`}
                    className="h-10 w-full rounded-xl border border-border bg-[#fcfaf8] px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeVariable(entryIndex)}
                  className="mb-0.5 flex h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[#a94725] hover:bg-[#fff0e9]"
                  title="Remove variable"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {entry.values.map((item, optionIndex) => (
                  <div
                    key={`addon-option-${entryIndex}-${optionIndex}`}
                    className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2"
                  >
                    <input
                      value={item.option}
                      onChange={(event) =>
                        updateOption(entryIndex, optionIndex, {
                          option: event.target.value,
                        })
                      }
                      placeholder="High"
                      aria-label={`Option ${optionIndex + 1} for variable ${entryIndex + 1}`}
                      className="h-9 min-w-0 rounded-lg border border-border bg-[#fcfaf8] px-2.5 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount}
                        onChange={(event) =>
                          updateOption(entryIndex, optionIndex, {
                            amount: event.target.value,
                          })
                        }
                        placeholder="0.03"
                        aria-label={`THB amount for option ${optionIndex + 1} for variable ${entryIndex + 1}`}
                        className="h-9 w-full rounded-lg border border-border bg-[#fcfaf8] px-2.5 pr-7 text-xs font-semibold outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        ฿
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(entryIndex, optionIndex)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-[#fff0e9] hover:text-[#a94725]"
                      title="Remove option"
                      aria-label={`Remove option ${optionIndex + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addOption(entryIndex)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-primary hover:bg-[#fff0e9]"
              >
                <Plus size={13} /> Add option
              </button>
            </section>
          ))}
        </div>

        <datalist id={`${rowKey(row)}-addon-variables`}>
          <option value="quality" />
          <option value="resolution" />
          <option value="aspect_ratio" />
        </datalist>

        <button
          type="button"
          onClick={addVariable}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-[#fff0e9]/45 px-3 py-2.5 text-xs font-bold text-primary hover:bg-[#fff0e9]"
        >
          <Plus size={15} /> Add variable
        </button>

        <div className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <CheckCircle2 size={15} /> Apply add-ons
          </Button>
        </div>
        <p className="mt-2 text-right text-[10px] text-muted-foreground">
          กด Save ที่แถวของ model เพื่อบันทึกลงระบบ
        </p>
      </form>
    </div>
  );
}

