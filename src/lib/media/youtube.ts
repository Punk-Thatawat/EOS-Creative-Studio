const youtubeVideoIdPattern = /^[a-zA-Z0-9_-]{11}$/;

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function getYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    if (!youtubeHosts.has(hostname) || !["http:", "https:"].includes(url.protocol)) return null;

    const path = url.pathname.split("/").filter(Boolean);
    const videoId = hostname.endsWith("youtu.be")
      ? path[0]
      : url.pathname === "/watch"
        ? url.searchParams.get("v") ?? undefined
        : ["embed", "shorts", "live", "v"].includes(path[0] ?? "")
          ? path[1]
          : undefined;

    return videoId && youtubeVideoIdPattern.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function isYouTubeVideoUrl(value: string | null | undefined): boolean {
  return getYouTubeVideoId(value) !== null;
}

export function getYouTubeEmbedUrl(value: string, options: { autoPlay?: boolean; muted?: boolean } = {}): string | null {
  const videoId = getYouTubeVideoId(value);
  if (!videoId) return null;

  const params = new URLSearchParams({ controls: "1", playsinline: "1", rel: "0" });
  if (options.autoPlay) params.set("autoplay", "1");
  if (options.muted) params.set("mute", "1");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
