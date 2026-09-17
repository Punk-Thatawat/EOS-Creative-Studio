import Image from "next/image";

export function HomeHero() {
  return <section className="pointer-events-none isolate overflow-hidden bg-transparent"><picture><source media="(max-width: 639px)" srcSet="/generated-icons-v2/creative-studio-5x4-transparent-final.webp" /><Image src="/generated-icons-v2/creative-studio-banner-transparent.webp" alt="Ideas that hit - EOS Creative Studio" width={1800} height={600} priority fetchPriority="high" sizes="(max-width: 639px) 100vw, (min-width: 640px) 75vw" className="block h-auto w-full object-contain object-center sm:h-[280px] lg:h-[330px]" /></picture></section>;
}
