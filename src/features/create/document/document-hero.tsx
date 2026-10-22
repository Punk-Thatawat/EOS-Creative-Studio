import Image from "next/image";

/** One shared banner for every tool in the document studio. */
export function DocumentHero() {
  return (
    <header className="studio-hero-frame" aria-label="GEN DOCUMENT">
      <picture>
        <Image
          src="/generated-assets/gen-document-hero-v2.png"
          alt="GEN DOCUMENT — AI document generation studio"
          width={2400}
          height={435}
          priority
          sizes="100vw"
        />
      </picture>
    </header>
  );
}
