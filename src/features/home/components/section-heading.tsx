import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ title, eyebrow, href, action = "View all", decorationSrc }: { title: string; eyebrow?: string; href?: string; action?: string; decorationSrc?: string }) { return <div className="mb-3 flex items-end justify-between gap-3"><div>{eyebrow ? <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{eyebrow}</p> : null}<div className="flex items-center gap-3"><h2 className="text-lg font-black tracking-tight">{title}</h2>{decorationSrc ? <Image src={decorationSrc} alt="" width={62} height={30} className="-ml-1 h-[30px] w-[62px] -translate-y-3 object-fill" /> : null}</div></div>{href ? <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-[#c85427]">{action} <ArrowRight size={13} /></Link> : null}</div>; }
