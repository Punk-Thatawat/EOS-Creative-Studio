/* eslint-disable @next/next/no-img-element */

"use client";

import Link from "next/link";
import { AudioLines, FileText, Image as ImageIcon, Package, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchAssets, type AssetsApiAsset, type AssetsApiType } from "@/lib/api/assets";
import { useLocale, type TranslationKey } from "@/lib/i18n/locale-provider";
import { ProjectCarousel } from "./project-carousel";

const assetTypeKeys: Record<AssetsApiType, TranslationKey> = {
  image: "home.assetType.image",
  video: "home.assetType.video",
  document: "home.assetType.document",
  audio: "home.assetType.audio",
  other: "home.assetType.other",
};

const assetBackgrounds: Record<AssetsApiType, string> = {
  image: "bg-[#e9c8ae]",
  video: "bg-[#37332e]",
  document: "bg-[#dfe8f0]",
  audio: "bg-[#f4d8e4]",
  other: "bg-[#e7e1dc]",
};

function formatAssetDate(value: string, locale: "th" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" }).format(date);
}

function AssetTypeIcon({ type }: { type: AssetsApiType }) {
  if (type === "video") return <Video size={28} strokeWidth={1.8} />;
  if (type === "audio") return <AudioLines size={28} strokeWidth={1.8} />;
  if (type === "document") return <FileText size={28} strokeWidth={1.8} />;
  if (type === "image") return <ImageIcon size={28} strokeWidth={1.8} />;
  return <Package size={28} strokeWidth={1.8} />;
}

function AssetCard({ asset, locale, t }: { asset: AssetsApiAsset; locale: "th" | "en"; t: (key: TranslationKey, params?: Record<string, string | number>) => string }) {
  const typeLabel = t(assetTypeKeys[asset.type]);
  const previewUrl = asset.previewUrl ?? asset.url;
  const metadata = [typeLabel, formatAssetDate(asset.createdAt, locale), asset.sizeLabel].filter(Boolean).join(" · ");

  return <Link href={`/assets?asset=${encodeURIComponent(asset.id)}`} className="group block min-w-[220px] snap-start rounded-2xl border border-border bg-surface p-2 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:min-w-[250px]" aria-label={t("home.openAsset", { title: asset.title })}>
    <div className={`relative flex h-28 items-center justify-center overflow-hidden rounded-xl ${assetBackgrounds[asset.type]}`}>
      {asset.type === "video" && asset.url ? <video className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" src={asset.url} poster={asset.previewUrl ?? undefined} preload="metadata" muted playsInline aria-hidden="true" /> : previewUrl ? <img src={previewUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <AssetTypeIcon type={asset.type} />}
      <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-1 text-[10px] font-bold text-foreground">{typeLabel}</span>
    </div>
    <div className="px-1 pb-1 pt-3"><h3 className="truncate text-xs font-bold" title={asset.title}>{asset.title}</h3><p className="mt-1 truncate text-[10px] text-muted-foreground">{metadata}</p></div>
  </Link>;
}

export function RecentAssets() {
  const { locale, t } = useLocale();
  const [assets, setAssets] = useState<AssetsApiAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAssets({ tab: "mine", sort: "newest", page: 1, limit: 5, signal: controller.signal })
      .then((data) => setAssets(data.assets.slice(0, 5)))
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  return <section>
    <div className="mb-3 flex items-end justify-between gap-4"><h2 className="text-lg font-black tracking-tight">{t("home.recentAssets")}</h2><Link href="/assets" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:text-[#c85427]">{t("home.viewAllAssets")} <span aria-hidden="true">→</span></Link></div>
    {isLoading ? <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">{t("home.loadingRecentAssets")}</div> : assets.length > 0 ? <ProjectCarousel previousLabel={t("home.previousAssets")} nextLabel={t("home.nextAssets")} className="[&>a]:shrink-0 [&>a]:basis-[82%] sm:[&>a]:basis-[48%] lg:[&>a]:basis-[32%] xl:[&>a]:basis-[24%] lg:[&>a]:min-w-0">{assets.map((asset) => <AssetCard key={asset.id} asset={asset} locale={locale} t={t} />)}</ProjectCarousel> : <div className="rounded-2xl border border-dashed border-border bg-surface p-6"><p className="text-sm font-bold">{error ? t("home.unableToLoadAssets") : t("home.noAssets")}</p><p className="mt-1 text-xs text-muted-foreground">{t("home.createFirstAsset")}</p></div>}
  </section>;
}
