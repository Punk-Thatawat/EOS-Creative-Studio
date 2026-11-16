"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { VideoSource } from "@/components/media/video-source";
import { listPublicLandingIntroVideo, type LandingIntroVideo } from "@/lib/api/video-showcase";
import { useLocale } from "@/lib/i18n/locale-provider";

export function IntroVideoPage() {
  const { t } = useLocale();
  const [video, setVideo] = useState<LandingIntroVideo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isActive = true;
    void listPublicLandingIntroVideo()
      .then((result) => {
        if (isActive) setVideo(result);
      })
      .catch(() => {
        if (isActive) setError(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const videoUrl = video?.enabled ? video.videoUrl : null;

  return (
    <main className="min-h-screen bg-[#f8f6f3] px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("introPage.back")}
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-white shadow-sm sm:mt-8">
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">EOS Creative Studio</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t("introPage.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {t("introPage.description")}
            </p>
          </div>

          <div className="border-t border-border bg-[#201d1b] p-2 sm:p-4">
            {videoUrl ? (
              <VideoSource
                key={videoUrl}
                src={videoUrl}
                className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl"
                ariaLabel={t("introPage.videoLabel")}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl px-6 text-center text-white">
                {video === null && !error ? <LoaderCircle size={28} className="animate-spin text-primary" aria-label={t("introPage.loadingLabel")} /> : <CircleAlert size={28} className="text-primary" aria-hidden="true" />}
                <p className="max-w-md text-sm leading-6 text-white/80">
                  {video === null && !error
                    ? t("introPage.loading")
                    : t("introPage.unavailable")}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
