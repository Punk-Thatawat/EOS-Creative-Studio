import Image from "next/image";

export function HomeHero() {
  return <section className="pointer-events-none isolate overflow-hidden bg-transparent"><Image src="/generated-icons-v2/creative-studio-5x4-transparent-final.png" alt="Ideas that hit - EOS Creative Studio" width={1500} height={1200} priority sizes="(max-width: 639px) 100vw" className="block h-auto w-full sm:hidden" /><Image src="/generated-icons-v2/creative-studio-banner-transparent.png" alt="Ideas that hit - EOS Creative Studio" width={1800} height={600} priority sizes="(min-width: 640px) 75vw" className="hidden w-full object-contain object-center sm:block sm:h-[280px] lg:h-[330px]" /></section>;
}
