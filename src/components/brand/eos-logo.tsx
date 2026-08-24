import Image from "next/image";
import Link from "next/link";

interface EosLogoProps {
  readonly href?: string;
  readonly className?: string;
}

export function EosLogo({ href = "/home", className = "" }: EosLogoProps) {
  const content = <span className={`inline-flex flex-col items-start ${className}`}><Image src="/generated-assets/eos-logo.webp" alt="EOS Creative Studio" width={128} height={50} priority className="h-auto w-[96px] object-contain object-left sm:w-[128px]" /><span className="mt-0.5 text-[6px] font-bold tracking-[0.08em] text-foreground sm:text-[8px] sm:tracking-[0.12em]">EOS CREATIVE STUDIO</span></span>;

  return <Link href={href} aria-label="EOS Creative Studio home">{content}</Link>;
}
