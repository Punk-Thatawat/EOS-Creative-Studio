import { RotateCcw } from "lucide-react";

type ClearValuesButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function ClearValuesButton({ onClick, disabled = false }: ClearValuesButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex h-8 min-h-8 touch:min-h-10 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#e1e1e1] bg-white px-2.5 text-[11px] font-semibold text-[#666a73] transition-colors hover:border-[#ff5a2f] hover:text-[#ff5a2f] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      title="เคลียร์ค่าทั้งหมดในหน้านี้"
      aria-label="เคลียร์ค่าทั้งหมดในหน้านี้"
    >
      <RotateCcw size={13} aria-hidden="true" />
      เคลียร์ทั้งหมด
    </button>
  );
}
