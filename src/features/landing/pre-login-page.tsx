"use client";

import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, MailCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { EosLogo } from "@/components/brand/eos-logo";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { fetchBackendSession } from "@/lib/auth/backend-session";
import { completePendingEmailLoginWithBackend, loginWithBackend, persistBackendSession, registerWithBackend, requestPasswordResetWithBackend, resendConfirmationWithBackend } from "@/lib/auth/backend-auth";
import { clearGenerationProgressStorage } from "@/lib/generation-progress-storage";
import { signInWithGoogle } from "@/lib/auth/google-login";
import { listPublicVideoShowcase } from "@/lib/api/video-showcase";
import { useLocale } from "@/lib/i18n/locale-provider";

const tools = [
  ["AI Image", "Generate stunning images", "/generated-icons-v2/icon-1-image.png"],
  ["AI Video", "Create engaging videos in minutes", "/generated-icons-v2/icon-2-video.png"],
  ["AI Presenter", "AI presenters that represent you", "/generated-icons-v2/icon-3-profile.png"],
  ["AI Audio", "Generate voiceovers and music", "/generated-icons-v2/icon-4-audio.png"],
  ["AI Document", "Smart docs with AI & OCR", "/generated-icons-v2/icon-5-document.png"],
  ["More Tools", "Custom AI workflows", "/generated-icons-v2/icon-6-sparkles.png"],
] as const;

const fallbackExamples = [
  { label: "PRODUCT AD", video: "/uploaded-videos/product-ad.mp4", webm: "/uploaded-videos/product-ad.webm" },
  { label: "BRAND CAMPAIGN", video: "/uploaded-videos/brand-campaign.mp4", webm: "/uploaded-videos/brand-campaign.webm" },
  { label: "AI PRESENTER VIDEO", video: "/uploaded-videos/ai-presenter.mp4", webm: "/uploaded-videos/ai-presenter.webm" },
  { label: "GROOVY GOODS", video: "/uploaded-videos/groovy-goods.mp4", webm: "/uploaded-videos/groovy-goods.webm" },
  { label: "BLOWAWAY", video: "/uploaded-videos/blowaway.mp4", webm: "/uploaded-videos/blowaway.webm" },
  { label: "TAPE LOOK", video: "/uploaded-videos/tape-look.mp4", webm: "/uploaded-videos/tape-look.webm" },
];

type ShowcaseExample = { id?: string; label: string; video: string; webm?: string; mimeType?: string };

const formatVideoDuration = (duration: number) => {
  if (!Number.isFinite(duration)) return "--:--";
  const totalSeconds = Math.round(duration);
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
};

const introVideoShownDateKey = "eos-intro-video-shown-date-v1";
const resendConfirmationCooldownSeconds = 30;

const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

type AuthMode = "login" | "register" | "confirmation" | "forgot";

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
  optionalLabel?: string;
  error?: string | null;
  showPassword?: boolean;
  passwordToggleLabel?: string;
  onTogglePassword?: () => void;
  onChange: (value: string) => void;
};

function AuthField({ id, label, value, placeholder, type, autoComplete, icon: Icon, disabled, required, minLength, hint, optional, optionalLabel, error, showPassword, passwordToggleLabel, onTogglePassword, onChange }: AuthFieldProps) {
  const inputType = type === "password" && showPassword ? "text" : type;
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`auth-field${error ? " auth-field--error" : ""}`}>
      <label htmlFor={id}>
        <span>{label}{optional ? <small>{optionalLabel}</small> : null}</span>
        {hint ? <em id={`${id}-hint`}>{hint}</em> : null}
      </label>
      <div className="auth-input-wrap">
        <Icon className="auth-input-icon" size={17} aria-hidden="true" />
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} type={inputType} placeholder={placeholder} autoComplete={autoComplete} autoCapitalize={type === "email" ? "none" : undefined} spellCheck={type === "email" ? false : undefined} required={required} minLength={minLength} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={descriptionId} />
        {type === "password" && onTogglePassword ? <button type="button" className="auth-password-toggle" aria-label={passwordToggleLabel} onClick={onTogglePassword} disabled={disabled}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button> : null}
      </div>
      {error ? <p id={`${id}-error`} className="auth-field-error"><CircleAlert size={13} aria-hidden="true" />{error}</p> : null}
    </div>
  );
}

type PasswordStrengthLabelKey = "auth.passwordStrength.needsMore" | "auth.passwordStrength.goodStart" | "auth.passwordStrength.strong";

function getPasswordStrength(password: string): { labelKey: PasswordStrengthLabelKey; score: number } {
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  return { score, labelKey: score <= 1 ? "auth.passwordStrength.needsMore" : score <= 2 ? "auth.passwordStrength.goodStart" : "auth.passwordStrength.strong" };
}

export function PreLoginPage() {
  const { t } = useLocale();
  const [examples, setExamples] = useState<ShowcaseExample[]>(fallbackExamples);
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
  const [pendingLoginToken, setPendingLoginToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [googleLoginError, setGoogleLoginError] = useState<string | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const maxExampleOffset = Math.max(0, examples.length - 5);
  const visibleExampleOffset = Math.min(exampleOffset, maxExampleOffset);
  const authEmailError = authEmail.length > 0 && !/^\S+@\S+\.\S+$/.test(authEmail) ? t("auth.validation.emailInvalid") : null;
  const authPasswordError = authMode === "register" && authPassword.length > 0 && authPassword.length < 8 ? t("auth.validation.passwordMin") : null;

  useEffect(() => {
    let active = true;
    listPublicVideoShowcase().then((items) => {
      if (!active) return;
      setVideoDurations({});
      setExamples(items.map((item) => ({ id: item.id, label: item.label, video: item.videoUrl ?? "", mimeType: item.mimeType })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoginLoading(true);
    setGoogleLoginError(null);
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setGoogleLoginLoading(false);
      setGoogleLoginError(error instanceof Error ? error.message : t("auth.error.googleStart"));
    }
  };

  const openLogin = () => {
    setAuthMode("login");
    setPasswordVisible(false);
    setConfirmationPasswordVisible(false);
    setAuthError(null);
    setAuthMessage(null);
    setPendingLoginToken(null);
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
    setPendingLoginToken(null);
    setGoogleLoginLoading(false);
    setGoogleLoginError(null);
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setPasswordVisible(false);
    setConfirmationPasswordVisible(false);
    setAuthError(null);
    setAuthMessage(null);
    setPendingLoginToken(null);
    setGoogleLoginError(null);
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      if (!authEmail.trim()) throw new Error(t("auth.validation.emailRequired"));
      if (authMode === "register") {
        if (authPassword.length < 8) throw new Error(t("auth.validation.passwordMinFull"));
        if (authPassword !== authPasswordConfirmation) throw new Error(t("auth.validation.passwordMismatch"));
        const result = await registerWithBackend({ email: authEmail, password: authPassword, display_name: authName.trim() || undefined });
        if (result.data.session) {
          clearGenerationProgressStorage();
          const accessToken = await persistBackendSession(result.data.session);
          const backendProfile = await fetchBackendSession(accessToken);
          window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
          window.location.replace("/home");
          return;
        }
        setAuthMode("confirmation");
        setAuthMessage(t("auth.confirmation.sent", { email: authEmail }));
        setPendingLoginToken(result.data.pendingLoginToken ?? null);
        setResendCooldown(resendConfirmationCooldownSeconds);
        return;
      }

      if (authMode === "forgot") {
        await requestPasswordResetWithBackend(authEmail);
        setAuthMessage(t("auth.reset.sent"));
        return;
      }

      const result = await loginWithBackend(authEmail, authPassword);
      if (result.data.emailConfirmationRequired && !result.data.session) {
        setAuthMode("confirmation");
        setAuthMessage(t("auth.confirmation.loginRequired", { email: authEmail }));
        setPendingLoginToken(result.data.pendingLoginToken ?? null);
        return;
      }
      if (!result.data.session) throw new Error(t("auth.validation.sessionMissing"));
      clearGenerationProgressStorage();
      const accessToken = await persistBackendSession(result.data.session);
      const backendProfile = await fetchBackendSession(accessToken);
      window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
      window.location.replace("/home");
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : t("auth.error.authenticationFailed"));
    } finally {
      setAuthSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loginOpen || authMode !== "confirmation" || !pendingLoginToken) return undefined;
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const result = await completePendingEmailLoginWithBackend(pendingLoginToken);
        if (!active || !result.data.session) return;
        setAuthSubmitting(false);
        setPendingLoginToken(null);
        clearGenerationProgressStorage();
        const accessToken = await persistBackendSession(result.data.session);
        const backendProfile = await fetchBackendSession(accessToken);
        window.sessionStorage.setItem("eos.backend.user-profile", JSON.stringify(backendProfile));
        window.location.replace("/home");
        return;
      } catch {
        // The account is normally still waiting for confirmation. Retry while
        // this browser remains on the waiting screen.
      }
      if (active) timer = window.setTimeout(() => { void poll(); }, 3000);
    };

    timer = window.setTimeout(() => { void poll(); }, 3000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [authMode, loginOpen, pendingLoginToken]);

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      await resendConfirmationWithBackend(authEmail);
      setAuthMessage(t("auth.confirmation.resent", { email: authEmail }));
      setResendCooldown(resendConfirmationCooldownSeconds);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : t("auth.error.resendConfirmation"));
    } finally {
      setAuthSubmitting(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

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
  }, [examples, showIntroVideo]);

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
    const sessionExpired = params.get("reason") === "session-expired";
    if (params.get("login") !== "1" && params.get("auth_error") !== "1" && !sessionExpired) return undefined;

    const timer = window.setTimeout(() => {
      if (params.get("auth_error") === "1") {
        const storedError = window.sessionStorage.getItem("eos.auth.login-error");
        setGoogleLoginError(storedError || t("auth.error.loginFailed"));
        window.sessionStorage.removeItem("eos.auth.login-error");
      }
      if (sessionExpired) setAuthError(t("auth.error.sessionExpired"));
      setLoginOpen(true);
      window.history.replaceState(null, "", window.location.pathname);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);

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
  }, [examples]);

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
        <div className="section-heading"><h2>SEE WHAT YOU CAN CREATE</h2><span>EXPLORE EXAMPLES</span><div className="carousel-actions"><button aria-label="Previous examples" onClick={() => setExampleOffset(Math.max(0, visibleExampleOffset - 1))} disabled={visibleExampleOffset === 0}><ChevronLeft size={18} /></button><button aria-label="Next examples" onClick={() => setExampleOffset(Math.min(maxExampleOffset, visibleExampleOffset + 1))} disabled={visibleExampleOffset >= maxExampleOffset}><ChevronRight size={18} /></button></div></div>
        <div className="example-window"><div className="example-track" style={{ transform: `translateX(-${visibleExampleOffset * 20.5}%)` }}>{examples.map((example, index) => <article className={`example-card example-${index}${index === visibleExampleOffset + 2 ? " example-featured" : ""}`} key={example.id ?? `${example.label}-${index}`}>
          <div className="example-placeholder">
            <video ref={(video) => { videoRefs.current[index] = video; }} className="example-video" muted loop playsInline preload="none" disablePictureInPicture disableRemotePlayback aria-label={`${example.label} preview`} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; setVideoDurations((current) => ({ ...current, [index]: formatVideoDuration(duration) })); }}>
              {example.webm ? <source src={example.webm} type="video/webm" /> : null}
              {example.video ? <source src={example.video} type={example.mimeType ?? "video/mp4"} /> : null}
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

      {loginOpen && <div className="auth-modal" role="dialog" aria-modal="true" aria-label={authMode === "login" ? t("auth.modal.loginTitle") : authMode === "register" ? t("auth.modal.registerTitle") : authMode === "forgot" ? t("auth.modal.forgotTitle") : t("auth.modal.confirmationTitle")} onClick={closeLogin}>
        <div className="auth-modal-shell" onClick={(event) => event.stopPropagation()}>
          <div className="auth-mobile-logo"><EosLogo href="/" /></div>
          <button type="button" className="auth-modal-close" aria-label={t("auth.a11y.closeLogin")} onClick={closeLogin}><X size={22} /></button>
          <div className={`auth-modal-panel auth-modal-panel--${authMode}`}>
          {authMode === "login" && <div className="auth-modal-heading-art"><Image src="/generated-assets/login-welcome-back.webp" alt={t("auth.modal.loginTitle")} fill sizes="430px" className="auth-heading-desktop" /><Image src="/generated-assets/login-welcome-mobile.webp" alt={t("auth.modal.loginTitle")} fill sizes="430px" className="auth-heading-mobile" /></div>}
          <div className={`auth-modal-heading${authMode !== "login" ? " is-visible" : ""}`}><span>{authMode === "confirmation" ? <Check size={21} /> : "✦"}</span><h2>{authMode === "login" ? t("auth.modal.loginTitle") : authMode === "register" ? t("auth.modal.registerTitle") : authMode === "forgot" ? t("auth.modal.forgotTitle") : t("auth.modal.confirmationTitle")}</h2></div>
          <p className="auth-modal-subtitle">{authMode === "login" ? t("auth.modal.loginSubtitle", { brand: "EOS Creative Studio" }) : authMode === "register" ? t("auth.modal.registerSubtitle", { brand: "EOS Creative Studio" }) : authMode === "forgot" ? t("auth.modal.forgotSubtitle") : t("auth.modal.confirmationSubtitle", { brand: "EOS Creative Studio" })}</p>

          {authMode === "confirmation" ? <div className="auth-confirmation-state">
            <div className="auth-confirmation-icon"><MailCheck size={29} /></div>
            <p>{authMessage ?? t("auth.confirmation.defaultSent", { email: authEmail })}</p>
            <button type="button" className="auth-secondary-button" onClick={() => { void handleResendConfirmation(); }} disabled={authSubmitting || resendCooldown > 0}>{authSubmitting ? <><LoaderCircle size={15} className="auth-spin" /> {t("auth.action.sending")}</> : resendCooldown > 0 ? t("auth.action.resendConfirmationCooldown", { seconds: resendCooldown }) : t("auth.action.resendConfirmation")}</button>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button type="button" className="auth-back-link" onClick={() => switchAuthMode("login")}>{t("auth.action.backToLogin")}</button>
          </div> : authMode === "forgot" && authMessage ? <div className="auth-confirmation-state"><div className="auth-confirmation-icon"><MailCheck size={29} /></div><p>{authMessage}</p><button type="button" className="auth-back-link" onClick={() => switchAuthMode("login")}>{t("auth.action.backToLogin")}</button></div> : <>
            <form onSubmit={handleEmailAuth}>
              {authMode === "register" && <AuthField id="modal-name" label={t("auth.form.name")} optional optionalLabel={t("auth.form.optional")} value={authName} onChange={setAuthName} type="text" placeholder={t("auth.form.namePlaceholder")} autoComplete="name" icon={UserRound} disabled={authSubmitting} />}
              <AuthField id="modal-email" label={t("auth.form.email")} value={authEmail} onChange={setAuthEmail} type="email" placeholder={t("auth.form.emailPlaceholder")} autoComplete="email" icon={Mail} required disabled={authSubmitting} error={authEmailError} />
              {authMode !== "forgot" && <AuthField id="modal-password" label={t("auth.form.password")} value={authPassword} onChange={setAuthPassword} type="password" placeholder={t("auth.form.passwordPlaceholder")} autoComplete={authMode === "login" ? "current-password" : "new-password"} icon={LockKeyhole} hint={authMode === "register" ? t("auth.form.passwordMinHint") : t("auth.form.privateHint")} minLength={authMode === "register" ? 8 : undefined} required disabled={authSubmitting} error={authPasswordError} showPassword={passwordVisible} passwordToggleLabel={passwordVisible ? t("auth.a11y.hidePassword") : t("auth.a11y.showPassword")} onTogglePassword={() => setPasswordVisible((visible) => !visible)} />}
              {authMode === "register" && <>
                {authPassword && <div className="auth-password-strength" aria-label={t("auth.a11y.passwordStrength", { strength: t(getPasswordStrength(authPassword).labelKey) })}>
                  <div className="auth-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((bar) => <span key={bar} className={bar <= getPasswordStrength(authPassword).score ? "is-filled" : ""} />)}</div>
                  <span>{t(getPasswordStrength(authPassword).labelKey)}</span>
                </div>}
                <AuthField id="modal-password-confirm" label={t("auth.form.confirmPassword")} value={authPasswordConfirmation} onChange={setAuthPasswordConfirmation} type="password" placeholder={t("auth.form.confirmPasswordPlaceholder")} autoComplete="new-password" icon={LockKeyhole} required minLength={8} disabled={authSubmitting} error={authPasswordConfirmation && authPassword !== authPasswordConfirmation ? t("auth.validation.passwordMismatch") : null} showPassword={confirmationPasswordVisible} passwordToggleLabel={confirmationPasswordVisible ? t("auth.a11y.hidePassword") : t("auth.a11y.showPassword")} onTogglePassword={() => setConfirmationPasswordVisible((visible) => !visible)} />
              </>}
              {authMode === "login" && <><label className="auth-remember"><input type="checkbox" defaultChecked /> {t("auth.form.keepSignedIn")}</label><button type="button" className="auth-forgot-link" onClick={() => switchAuthMode("forgot")}>{t("auth.action.forgotPassword")}</button></>}
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <div className="auth-submit-wrap"><Image src="/generated-assets/login-button-brush.webp" alt="" fill sizes="430px" className="auth-brush-desktop" /><Image src="/generated-assets/login-button-brush-mobile.webp" alt="" fill sizes="430px" className="auth-brush-mobile" /><button type="submit" className="auth-submit" disabled={authSubmitting}>{authSubmitting ? <><LoaderCircle size={18} className="auth-spin" /> {authMode === "login" ? t("auth.action.signingIn") : t("auth.action.sending")}</> : <>{authMode === "login" ? t("auth.action.login") : authMode === "forgot" ? t("auth.action.sending") : t("auth.action.register")} <ArrowRight size={20} /></>}</button></div>
            </form>
            {authMode !== "forgot" && <div className="auth-divider"><span>{t("auth.action.continueWith")}</span></div>}
            {googleLoginError && <p className="auth-error" role="alert">{googleLoginError}</p>}
            {authMode !== "forgot" && <><div className="auth-socials"><button type="button" onClick={() => { void handleGoogleLogin(); }} disabled={googleLoginLoading || authSubmitting} aria-busy={googleLoginLoading}><Image src="/generated-assets/google-g-icon.svg" alt="" width={18} height={18} /> <span>{googleLoginLoading ? t("auth.action.connecting") : "Google"}</span></button></div><p className="auth-signup">{authMode === "login" ? <>{t("auth.footer.noAccount")} <button type="button" onClick={() => switchAuthMode("register")}>{t("auth.action.signUp")}</button></> : <>{t("auth.footer.hasAccount")} <button type="button" onClick={() => switchAuthMode("login")}>{t("auth.action.login")}</button></>}</p></>}
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
