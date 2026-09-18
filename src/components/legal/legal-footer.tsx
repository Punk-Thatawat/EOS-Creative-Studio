import { LegalLinks } from "@/features/legal/legal-page";

export function LegalFooter() {
  return <footer className="mt-8 flex flex-col gap-2 border-t border-[#ebe4df] px-1 py-4 text-xs text-[#999196] md:flex-row md:items-center md:justify-between md:gap-6"><span>EOS Creative Studio</span><LegalLinks /></footer>;
}
