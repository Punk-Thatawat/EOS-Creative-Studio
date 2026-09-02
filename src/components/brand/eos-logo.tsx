import Image from "next/image";
import Link from "next/link";

interface EosLogoProps {
  readonly href?: string;
  readonly className?: string;
}

export function EosLogo({ href = "/home", className = "" }: EosLogoProps) {
  const content = (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <Image
        src="/generated-assets/eos-logo.png"
        alt="EOS Creative Studio"
        width={422}
        height={152}
        priority
        className="h-auto w-[96px] object-contain object-left sm:w-[128px]"
      />
    </span>
  );

  return <Link href={href} aria-label="EOS Creative Studio home">{content}</Link>;
}
