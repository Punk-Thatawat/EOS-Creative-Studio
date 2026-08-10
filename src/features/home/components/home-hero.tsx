import Image from "next/image";

export function HomeHero() {
  return <section className="pointer-events-none relative z-40 -mt-6 aspect-[5/4] overflow-hidden bg-transparent sm:-mt-8 sm:aspect-auto sm:h-[280px] lg:-mt-[88px] lg:h-[330px]"><Image src="/generated-icons-v2/creative-studio-5x4-transparent-final.png" alt="Ideas that hit - EOS Creative Studio" fill priority sizes="(max-width: 639px) 100vw" className="absolute inset-0 block h-full w-full object-cover object-center sm:hidden" /><Image src="/generated-icons-v2/creative-studio-banner-transparent.png" alt="Ideas that hit - EOS Creative Studio" fill priority sizes="(min-width: 640px) 75vw" className="absolute inset-0 hidden h-full w-full origin-center rotate-[-0.35deg] object-contain object-center mix-blend-multiply sm:block" /></section>;
}
