"use client";

import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EosLogo } from "@/components/brand/eos-logo";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { isDevAuthBypassEnabled } from "@/lib/auth/access-token";
import { signInWithGoogle } from "@/lib/auth/google-login";

const tools = [
  ["AI Image", "Generate stunning images", "/generated-icons-v2/icon-1-image.png"],
  ["AI Video", "Create engaging videos in minutes", "/generated-icons-v2/icon-2-video.png"],
  ["AI Presenter", "AI presenters that represent you", "/generated-icons-v2/icon-3-profile.png"],
  ["AI Audio", "Generate voiceovers and music", "/generated-icons-v2/icon-4-audio.png"],
  ["AI Document", "Smart docs with AI & OCR", "/generated-icons-v2/icon-5-document.png"],
  ["More Tools", "Custom AI workflows", "/generated-icons-v2/icon-6-sparkles.png"],
] as const;

const examples = [
  { label: "PRODUCT AD", video: "/uploaded-videos/product-ad.mp4", webm: "/uploaded-videos/product-ad.webm" },
  { label: "BRAND CAMPAIGN", video: "/uploaded-videos/brand-campaign.mp4", webm: "/uploaded-videos/brand-campaign.webm" },
  { label: "AI PRESENTER VIDEO", video: "/uploaded-videos/ai-presenter.mp4", webm: "/uploaded-videos/ai-presenter.webm" },
  { label: "GROOVY GOODS", video: "/uploaded-videos/groovy-goods.mp4", webm: "/uploaded-videos/groovy-goods.webm" },
  { label: "BLOWAWAY", video: "/uploaded-videos/blowaway.mp4", webm: "/uploaded-videos/blowaway.webm" },
  { label: "TAPE LOOK", video: "/uploaded-videos/tape-look.mp4", webm: "/uploaded-videos/tape-look.webm" },
];

const formatVideoDuration = (duration: number) => {
  if (!Number.isFinite(duration)) return "--:--";
  const totalSeconds = Math.round(duration);
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
};

const introVideoShownDateKey = "eos-intro-video-shown-date-v1";

const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function PreLoginPage() {
  const [exampleOffset, setExampleOffset] = useState(0);
  const [videoDurations, setVideoDurations] = useState<Record<number, string>>({});
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  const handleGoogleLogin = async () => {
    setGoogleLoginLoading(true);
    setGoogleLoginError(null);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setGoogleLoginLoading(false);
      setGoogleLoginError(error instanceof Error ? error.message : "Unable to start Google login");
    }
  };

  const openLogin = () => {
    if (isDevAuthBypassEnabled()) {
      window.location.replace("/home");
      return;
    }
    setGoogleLoginLoading(false);
    setGoogleLoginError(null);
    setLoginOpen(true);
  };

  const closeLogin = () => {
    setLoginOpen(false);
    setGoogleLoginLoading(false);
    setGoogleLoginError(null);
  };

  useEffect(() => {
    const videos = videoRefs.current.filter((video): video is HTMLVideoElement => Boolean(video));
    if (showIntroVideo) {
      videos.forEach((video) => video.pause());
      return undefined;
    }
    if (typeof IntersectionObserver === "undefined") {
      videos.forEach((video) => void video.play().catch(() => undefined));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        const index = videoRefs.current.indexOf(video);
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      });
    }, { rootMargin: "120px 0px", threshold: 0.1 });
    videos.forEach((video) => observer.observe(video));
    return () => {
      observer.disconnect();
      videos.forEach((video) => video.pause());
    };
  }, [showIntroVideo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = getLocalDateKey();
      let hasShownToday = false;

      try {
        hasShownToday = window.localStorage.getItem(introVideoShownDateKey) === today;
        if (!hasShownToday) window.localStorage.setItem(introVideoShownDateKey, today);
      } catch {
        // If storage is unavailable, allow the intro to show for this visit.
      }

      if (!hasShownToday) setShowIntroVideo(true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const resetGoogleLoginState = () => {
      if (document.visibilityState === "visible") {
        setGoogleLoginLoading(false);
      }
    };
    window.addEventListener("pageshow", resetGoogleLoginState);
    document.addEventListener("visibilitychange", resetGoogleLoginState);
    return () => {
      window.removeEventListener("pageshow", resetGoogleLoginState);
      document.removeEventListener("visibilitychange", resetGoogleLoginState);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") !== "1" && params.get("auth_error") !== "1") return undefined;

    if (params.get("auth_error") === "1") {
      const storedError = window.sessionStorage.getItem("eos.auth.login-error");
      setGoogleLoginError(storedError || "Login failed. Please try again.");
      window.sessionStorage.removeItem("eos.auth.login-error");
    }

    const timer = window.setTimeout(() => setLoginOpen(true), 0);
    window.history.replaceState(null, "", window.location.pathname);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanups = videoRefs.current.map((video, index) => {
      if (!video) return undefined;
      const updateDuration = () => {
        if (video.duration > 0) {
          setVideoDurations((current) => ({ ...current, [index]: formatVideoDuration(video.duration) }));
        }
      };
      updateDuration();
      video.addEventListener("loadedmetadata", updateDuration);
      video.addEventListener("durationchange", updateDuration);
      return () => {
        video.removeEventListener("loadedmetadata", updateDuration);
        video.removeEventListener("durationchange", updateDuration);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-header">
        <EosLogo href="/" />
        <button type="button" className="login-button" onClick={openLogin}>
          <span>LOGIN / SIGN UP</span> <ArrowRight size={21} />
        </button>
      </header>

      <section className="landing-hero">
        <div className="hero-visual placeholder-visual" aria-label="EOS creative studio hero artwork">
          <Image src="/generated-assets/creative-studio-hero-with-text-right-copy.webp" alt="Create without limits - EOS Creative Studio" fill priority sizes="100vw" className="hero-artwork hero-artwork-desktop" />
          <Image src="/generated-assets/hero-mobile-5x4.webp" alt="Create without limits - EOS Creative Studio" fill sizes="100vw" className="hero-artwork hero-artwork-mobile" />
        </div>
      </section>

      <section id="tools" className="tool-strip" aria-label="Creative tools">
        {tools.map(([title, description, imageSrc]) => (
          <div className="tool-item" key={title}>
            <Image className="tool-image" src={imageSrc} alt="" width={72} height={72} />
            <strong>{title}</strong>
            <small>{description}</small>
          </div>
        ))}
      </section>

      <section id="examples" className="examples-section">
        <div className="section-heading"><h2>SEE WHAT YOU CAN CREATE</h2><span>EXPLORE EXAMPLES</span><div className="carousel-actions"><button aria-label="Previous examples" onClick={() => setExampleOffset(Math.max(0, exampleOffset - 1))}><ChevronLeft size={18} /></button><button aria-label="Next examples" onClick={() => setExampleOffset(Math.min(1, exampleOffset + 1))}><ChevronRight size={18} /></button></div></div>
        <div className="example-window"><div className="example-track" style={{ transform: `translateX(-${exampleOffset * 20.5}%)` }}>{examples.map((example, index) => <article className={`example-card example-${index}${index === exampleOffset + 2 ? " example-featured" : ""}`} key={example.label}>
          <div className="example-placeholder">
            <video ref={(video) => { videoRefs.current[index] = video; }} className="example-video" muted loop playsInline preload="none" disablePictureInPicture disableRemotePlayback aria-label={`${example.label} preview`} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; setVideoDurations((current) => ({ ...current, [index]: formatVideoDuration(duration) })); }}>
              <source src={example.webm} type="video/webm" />
              <source src={example.video} type="video/mp4" />
            </video>
          </div>
          <div className="example-label">{example.label}<time>{videoDurations[index] ?? "--:--"}</time></div>
        </article>)}</div></div>
      </section>

      {showIntroVideo && <div className="video-modal intro-video-modal" role="dialog" aria-modal="true" aria-label="AI Image Generator intro video" onClick={() => setShowIntroVideo(false)}>
        <div className="intro-video-decor" aria-hidden="true">
          <Image src="/generated-assets/intro-corner-top-left-transparent.webp" alt="" width={1672} height={940} className="intro-video-decor-image" />
          <Image src="/generated-assets/intro-corner-bottom-left-transparent.webp" alt="" width={1672} height={940} className="intro-video-decor-image" />
          <Image src="/generated-assets/intro-corner-bottom-right-transparent.webp" alt="" width={1672} height={940} className="intro-video-decor-image" />
        </div>
        <div className="video-modal-shell" onClick={(event) => event.stopPropagation()}>
          <div className="video-modal-actions"><button type="button" className="video-modal-close" aria-label="Close intro video" onClick={() => setShowIntroVideo(false)}><X size={24} /></button></div>
          <EosVideoPlayer
            src="/uploaded-videos/intro-ai-image-generator.mp4"
            autoPlay
            muted
            ariaLabel="AI Image Generator intro video"
            onEnded={() => setShowIntroVideo(false)}
          />
          <div className="video-modal-caption"><strong>AI IMAGE GENERATOR</strong><span>EOS CREATIVE STUDIO</span></div>
        </div>
      </div>}

      {loginOpen && <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Login" onClick={closeLogin}>
        <div className="auth-modal-shell" onClick={(event) => event.stopPropagation()}>
          <div className="auth-mobile-logo"><EosLogo href="/" /></div>
          <button type="button" className="auth-modal-close" aria-label="Close login" onClick={closeLogin}><X size={22} /></button>
          <div className="auth-modal-panel">
          <div className="auth-modal-heading-art"><Image src="/generated-assets/login-welcome-back.webp" alt="Welcome back" fill sizes="430px" className="auth-heading-desktop" /><Image src="/generated-assets/login-welcome-mobile.webp" alt="Welcome back" fill sizes="430px" className="auth-heading-mobile" /></div>
          <div className="auth-modal-heading"><span>✦</span><h2>Welcome back</h2></div>
          <p className="auth-modal-subtitle">Login to your <strong>EOS Creative Studio</strong> account</p>
          <label htmlFor="modal-email">Email address</label>
          <input id="modal-email" type="email" placeholder="you@example.com" autoComplete="email" />
          <div className="auth-password-row"><label htmlFor="modal-password">Password</label><button type="button">Forgot password?</button></div>
          <input id="modal-password" type="password" placeholder="••••••••••••" autoComplete="current-password" />
          <label className="auth-remember"><input type="checkbox" /> Remember me</label>
            <div className="auth-submit-wrap"><Image src="/generated-assets/login-button-brush.webp" alt="" fill sizes="430px" className="auth-brush-desktop" /><Image src="/generated-assets/login-button-brush-mobile.webp" alt="" fill sizes="430px" className="auth-brush-mobile" /><button type="button" className="auth-submit">LOGIN <ArrowRight size={20} /></button></div>
          <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
           {googleLoginError && <p className="auth-error" role="alert">{googleLoginError}</p>}
           <div className="auth-socials"><button type="button" onClick={() => { void handleGoogleLogin(); }} disabled={googleLoginLoading} aria-busy={googleLoginLoading}><Image src="/generated-assets/google-g-icon.svg" alt="" width={18} height={18} /> <span>{googleLoginLoading ? "Connecting..." : "Google"}</span></button></div>
          <p className="auth-signup">Don&apos;t have an account? <button type="button">Sign up</button></p>
          </div>
        </div>
      </div>}

      <footer className="landing-cta">
          <Image src="/generated-assets/landing-cta-no-generated-button.webp" alt="Power your creativity and elevate your impact" fill sizes="100vw" className="cta-artwork" />
          <Image src="/generated-assets/landing-cta-mobile-reserved.webp" alt="Power your creativity and elevate your impact" fill sizes="100vw" className="cta-artwork-mobile" />
        <div className="cta-action-group">
          <Image src="/generated-assets/cta-brush-only-transparent-v2-cropped.webp" alt="" width={2124} height={279} className="cta-brush-overlay" aria-hidden="true" />
          <Image src="/generated-assets/footer-cta-brush-transparent.webp" alt="" width={1983} height={793} className="cta-brush-overlay-mobile" aria-hidden="true" />
          <button type="button" className="cta-overlay-link" aria-label="Get started free" onClick={openLogin}>
            <span>GET STARTED FREE</span>
            <ArrowRight size={23} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </main>
  );
}
