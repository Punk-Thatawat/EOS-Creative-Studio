"use client";

import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, MailCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { EosLogo } from "@/components/brand/eos-logo";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { loginWithBackend, persistBackendSession, registerWithBackend, resendConfirmationWithBackend } from "@/lib/auth/backend-auth";
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

type AuthMode = "login" | "register" | "confirmation";

type AuthFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  icon: LucideIcon;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  hint?: string;
  optional?: boolean;
  error?: string | null;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  onChange: (value: string) => void;
};

function AuthField({ id, label, value, placeholder, type, autoComplete, icon: Icon, disabled, required, minLength, hint, optional, error, showPassword, onTogglePassword, onChange }: AuthFieldProps) {
  const inputType = type === "password" && showPassword ? "text" : type;
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}`}>
      <label htmlFor={id}>
        <span>{label}{optional ? <small>optional</small> : null}</span>
        {hint ? <em id={`${id}-hint`}>{hint}</em> : null}
      </label>
      <div className="auth-input-wrap">
        <Icon className="auth-input-icon" size={17} aria-hidden="true" />
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={inputType} placeholder={placeholder} autoComplete={autoComplete} autoCapitalize={type === "email" ? "none" : undefined} spellCheck={type === "email" ? false : undefined} required={required} minLength={minLength} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={descriptionId} />
        {type === "password" && onTogglePassword ? <button type="button" className="auth-password-toggle" aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={onTogglePassword} disabled={disabled}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button> : null}
      </div>
      {error ? <p id={`${id}-error`} className="auth-field-error"><CircleAlert size={13} aria-hidden="true" />{error}</p> : null}
    </div>
  );
}

function getPasswordStrength(password: string): { label: string; score: number } {
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  return { score, label: score <= 1 ? "Needs more strength" : score <= 2 ? "Good start" : "Strong password" };
}

export function PreLoginPage() {
  const [exampleOffset, setExampleOffset] = useState(0);
  const [videoDurations, setVideoDurations] = useState<Record<number, string>>({});
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirmation, setAuthPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationPasswordVisible, setConfirmationPasswordVisible] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const authEmailError = authEmail.length > 0 && !/^\S+@\S+\.\S+$/.test(authEmail) ? "Enter a valid email address" : null;
  const authPasswordError = authMode === "register" && authPassword.length > 0 && authPassword.length < 8 ? "Use at least 8 characters" : null;

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
    setAuthMode("login");
    setPasswordVisible(false);
    setConfirmationPasswordVisible(false);
    setAuthError(null);
    setAuthMessage(null);
    setGoogleLoginLoading(false);
    setGoogleLoginError(null);
    setLoginOpen(true);
  };

  const closeLogin = () => {
    setLoginOpen(false);
    setPasswordVisible(false);
    setConfirmationPasswordVisible(false);
    setAuthSubmitting(false);
    setAuthError(null);
    setAuthMessage(null);
    setGoogleLoginLoading(false);
    setGoogleLoginError(null);
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setPasswordVisible(false);
    setConfirmationPasswordVisible(false);
    setAuthError(null);
    setAuthMessage(null);
    setGoogleLoginError(null);
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      if (!authEmail.trim()) throw new Error("Enter your email address");
      if (authMode === "register") {
        if (authPassword.length < 8) throw new Error("Use at least 8 characters for your password");
        if (authPassword !== authPasswordConfirmation) throw new Error("Passwords do not match");
        const result = await registerWithBackend({ email: authEmail, password: authPassword, display_name: authName.trim() || undefined });
        if (result.data.session) {
          const accessToken = await persistBackendSession(result.data.session);
          const backendProfile = await fetchBackendSession(accessToken);
          window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
          window.location.replace("/home");
          return;
        }
        setAuthMode("confirmation");
        setAuthMessage(`We sent a confirmation link to ${authEmail}. Please check your inbox to activate your account.`);
        return;
      }

      const result = await loginWithBackend(authEmail, authPassword);
      if (!result.data.session) throw new Error("Login did not create a session");
      const accessToken = await persistBackendSession(result.data.session);
      const backendProfile = await fetchBackendSession(accessToken);
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
      window.location.replace("/home");
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      await resendConfirmationWithBackend(authEmail);
      setAuthMessage(`A new confirmation link was sent to ${authEmail}.`);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Could not resend the confirmation email.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loginOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLogin();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loginOpen]);

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

    const timer = window.setTimeout(() => {
      if (params.get("auth_error") === "1") {
        const storedError = window.sessionStorage.getItem("eos.auth.login-error");
        setGoogleLoginError(storedError || "Login failed. Please try again.");
        window.sessionStorage.removeItem("eos.auth.login-error");
      }
      setLoginOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }, 0);
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

      {loginOpen && <div className="auth-modal" role="dialog" aria-modal="true" aria-label={authMode === "login" ? "Login" : authMode === "register" ? "Create account" : "Confirm email"} onClick={closeLogin}>
        <div className="auth-modal-shell" onClick={(event) => event.stopPropagation()}>
          <div className="auth-mobile-logo"><EosLogo href="/" /></div>
          <button type="button" className="auth-modal-close" aria-label="Close login" onClick={closeLogin}><X size={22} /></button>
          <div className={`auth-modal-panel auth-modal-panel--${authMode}`}>
          {authMode === "login" && <div className="auth-modal-heading-art"><Image src="/generated-assets/login-welcome-back.webp" alt="Welcome back" fill sizes="430px" className="auth-heading-desktop" /><Image src="/generated-assets/login-welcome-mobile.webp" alt="Welcome back" fill sizes="430px" className="auth-heading-mobile" /></div>}
          <div className={`auth-modal-heading${authMode !== "login" ? " is-visible" : ""}`}><span>{authMode === "confirmation" ? <Check size={21} /> : "✦"}</span><h2>{authMode === "login" ? "Welcome back" : authMode === "register" ? "Create your account" : "Check your inbox"}</h2></div>
          <p className="auth-modal-subtitle">{authMode === "login" ? <>Login to your <strong>EOS Creative Studio</strong> account</> : authMode === "register" ? <>Start creating with <strong>EOS Creative Studio</strong></> : <>Confirm your email to activate your <strong>EOS Creative Studio</strong> account</>}</p>

          {authMode === "confirmation" ? <div className="auth-confirmation-state">
            <div className="auth-confirmation-icon"><MailCheck size={29} /></div>
            <p>{authMessage ?? `We sent a confirmation link to ${authEmail}.`}</p>
            <button type="button" className="auth-secondary-button" onClick={() => { void handleResendConfirmation(); }} disabled={authSubmitting}>{authSubmitting ? <><LoaderCircle size={15} className="auth-spin" /> Sending...</> : "Resend confirmation email"}</button>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button type="button" className="auth-back-link" onClick={() => switchAuthMode("login")}>Back to login</button>
          </div> : <>
            <form onSubmit={handleEmailAuth}>
              {authMode === "register" && <AuthField id="modal-name" label="Name" optional value={authName} onChange={setAuthName} type="text" placeholder="Your name" autoComplete="name" icon={UserRound} disabled={authSubmitting} />}
              <AuthField id="modal-email" label="Email address" value={authEmail} onChange={setAuthEmail} type="email" placeholder="you@example.com" autoComplete="email" icon={Mail} required disabled={authSubmitting} error={authEmailError} />
              <AuthField id="modal-password" label="Password" value={authPassword} onChange={setAuthPassword} type="password" placeholder="Enter your password" autoComplete={authMode === "login" ? "current-password" : "new-password"} icon={LockKeyhole} hint={authMode === "register" ? "8+ characters" : "Keep it private"} minLength={authMode === "register" ? 8 : undefined} required disabled={authSubmitting} error={authPasswordError} showPassword={passwordVisible} onTogglePassword={() => setPasswordVisible((visible) => !visible)} />
              {authMode === "register" && <>
                {authPassword && <div className="auth-password-strength" aria-label={`Password strength: ${getPasswordStrength(authPassword).label}`}>
                  <div className="auth-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((bar) => <span key={bar} className={bar <= getPasswordStrength(authPassword).score ? "is-filled" : ""} />)}</div>
                  <span>{getPasswordStrength(authPassword).label}</span>
                </div>}
                <AuthField id="modal-password-confirm" label="Confirm password" value={authPasswordConfirmation} onChange={setAuthPasswordConfirmation} type="password" placeholder="Re-enter your password" autoComplete="new-password" icon={LockKeyhole} required minLength={8} disabled={authSubmitting} error={authPasswordConfirmation && authPassword !== authPasswordConfirmation ? "Passwords do not match" : null} showPassword={confirmationPasswordVisible} onTogglePassword={() => setConfirmationPasswordVisible((visible) => !visible)} />
              </>}
              {authMode === "login" && <label className="auth-remember"><input type="checkbox" defaultChecked /> Keep me signed in</label>}
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <div className="auth-submit-wrap"><Image src="/generated-assets/login-button-brush.webp" alt="" fill sizes="430px" className="auth-brush-desktop" /><Image src="/generated-assets/login-button-brush-mobile.webp" alt="" fill sizes="430px" className="auth-brush-mobile" /><button type="submit" className="auth-submit" disabled={authSubmitting}>{authSubmitting ? <><LoaderCircle size={18} className="auth-spin" /> {authMode === "login" ? "Signing in..." : "Creating account..."}</> : <>{authMode === "login" ? "LOGIN" : "CREATE ACCOUNT"} <ArrowRight size={20} /></>}</button></div>
            </form>
            <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
            {googleLoginError && <p className="auth-error" role="alert">{googleLoginError}</p>}
            <div className="auth-socials"><button type="button" onClick={() => { void handleGoogleLogin(); }} disabled={googleLoginLoading || authSubmitting} aria-busy={googleLoginLoading}><Image src="/generated-assets/google-g-icon.svg" alt="" width={18} height={18} /> <span>{googleLoginLoading ? "Connecting..." : "Google"}</span></button></div>
            <p className="auth-signup">{authMode === "login" ? <>Don&apos;t have an account? <button type="button" onClick={() => switchAuthMode("register")}>Sign up</button></> : <>Already have an account? <button type="button" onClick={() => switchAuthMode("login")}>Login</button></>}</p>
          </>}
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
