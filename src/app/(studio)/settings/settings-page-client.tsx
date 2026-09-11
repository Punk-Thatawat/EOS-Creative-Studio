"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Globe2,
  Info,
  KeyRound,
  Languages,
  LockKeyhole,
  Mail,
  Monitor,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { changePasswordWithBackend, getStoredBackendSession } from "@/lib/auth/backend-auth";
import { getApiAccessToken } from "@/lib/auth/access-token";
import { fetchBackendAuthProvider } from "@/lib/auth/backend-session";
import { useLocale, type Locale, type TranslationKey } from "@/lib/i18n/locale-provider";
import styles from "./settings-page.module.css";

const settingsKeys = {
  eyebrow: "settings.eyebrow",
  title: "settings.title",
  description: "settings.description",
  ready: "settings.ready",
  save: "settings.save",
  saved: "settings.saved",
  saving: "settings.saving",
  overview: "settings.overview",
  language: "settings.language",
  languageDescription: "settings.languageDescription",
  defaultLanguage: "settings.defaultLanguage",
  font: "settings.font",
  fontValue: "settings.fontValue",
  fontHint: "settings.fontHint",
  security: "settings.security",
  securityDescription: "settings.securityDescription",
  authentication: "settings.authentication",
  authenticationValue: "settings.authenticationValue",
  authenticationEmail: "settings.authenticationEmail",
  authenticationGoogle: "settings.authenticationGoogle",
  authenticationLoading: "settings.authenticationLoading",
  activeSessions: "settings.activeSessions",
  activeSessionsValue: "settings.activeSessionsValue",
  reviewSessions: "settings.reviewSessions",
  password: "settings.password",
  passwordDescription: "settings.passwordDescription",
  currentPassword: "settings.currentPassword",
  newPassword: "settings.newPassword",
  confirmPassword: "settings.confirmPassword",
  changePassword: "settings.changePassword",
  changingPassword: "settings.changingPassword",
  passwordChanged: "settings.passwordChanged",
  passwordLoginRequired: "settings.passwordLoginRequired",
  passwordManagedByGoogle: "settings.passwordManagedByGoogle",
  passwordChangeFailed: "settings.passwordChangeFailed",
  notifications: "settings.notifications",
  notificationsDescription: "settings.notificationsDescription",
  emailUpdates: "settings.emailUpdates",
  emailUpdatesHint: "settings.emailUpdatesHint",
  projectActivity: "settings.projectActivity",
  projectActivityHint: "settings.projectActivityHint",
  securityAlerts: "settings.securityAlerts",
  securityAlertsHint: "settings.securityAlertsHint",
  on: "settings.on",
  off: "settings.off",
  help: "settings.help",
  helpLink: "settings.helpLink",
  languageSaved: "settings.languageSaved",
  languageSavedLocal: "settings.languageSavedLocal",
  tipTitle: "settings.tipTitle",
  tipDescription: "settings.tipDescription",
  learnMore: "settings.learnMore",
} as const;

type Copy = { [Key in keyof typeof settingsKeys]: string };

const sectionIds = ["language", "security"] as const;
const showNotificationSettings = false;

async function syncLocale(locale: Locale) {
  const token = await getApiAccessToken();
  if (!token) return false;

  const configuredBackendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  const backendUrl = configuredBackendUrl.replace(/\/api\/v1$/, "");
  const response = await fetch(`${backendUrl}/api/v1/users/me`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify({ locale }),
  });
  return response.ok;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${checked ? styles.toggleActive : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

function SectionHeading({ icon: Icon, title, description, tone = "orange" }: { icon: typeof Globe2; title: string; description: string; tone?: "orange" | "pink" | "yellow" }) {
  return (
    <div className={styles.sectionHeading}>
      <span className={`${styles.sectionIcon} ${styles[`tone${tone}`]}`}><Icon size={18} strokeWidth={1.9} /></span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function SettingRow({ icon: Icon, title, description, value, children }: { icon: typeof Mail; title: string; description: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.rowIcon}><Icon size={17} /></span>
      <div className={styles.rowCopy}>
        <p className={styles.rowTitle}>{title}</p>
        <p className={styles.rowDescription}>{description}</p>
      </div>
      {value ? <span className={styles.rowValue}>{value}</span> : null}
      {children}
    </div>
  );
}

export function SettingsPageClient() {
  const { locale, setLocale, persistLocale, t: translateKey } = useLocale();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof sectionIds)[number]>("language");
  const [notifications, setNotifications] = useState({ email: true, project: true, security: true });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [authProvider, setAuthProvider] = useState<"loading" | "email" | "google" | "unknown">("loading");

  const t: Copy = useMemo(
    () => Object.fromEntries(Object.entries(settingsKeys).map(([name, key]) => [name, translateKey(key as TranslationKey)])) as Copy,
    [translateKey],
  );

  useEffect(() => {
    let active = true;
    void getApiAccessToken()
      .then((accessToken) => accessToken ? fetchBackendAuthProvider(accessToken) : null)
      .then((provider) => {
        if (active) setAuthProvider(provider ?? "unknown");
      })
      .catch(() => {
        if (active) setAuthProvider("unknown");
      });
    return () => {
      active = false;
    };
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setSaved(false);
    document.documentElement.lang = nextLocale;
  }

  async function handleSave() {
    setSaving(true);
    persistLocale(locale);
    try {
      await syncLocale(locale);
    } catch {
      // Local preference remains usable when the backend is unavailable.
    } finally {
      setSaving(false);
      setSaved(true);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordForm.next.length < 8 || passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ tone: "error", text: passwordForm.next.length < 8 ? translateKey("auth.validation.passwordMinFull") : translateKey("auth.validation.passwordMismatch") });
      return;
    }
    setPasswordSaving(true);
    setPasswordMessage(null);
    try {
      const accessToken = await getApiAccessToken({ forceRefresh: true });
      const session = getStoredBackendSession();
      if (!accessToken) throw new Error(t.passwordLoginRequired);
      await changePasswordWithBackend({ currentPassword: passwordForm.current, newPassword: passwordForm.next, refreshToken: session?.refreshToken }, accessToken);
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordMessage({ tone: "success", text: t.passwordChanged });
    } catch (error: unknown) {
      setPasswordMessage({ tone: "error", text: error instanceof Error ? error.message : t.passwordChangeFailed });
    } finally {
      setPasswordSaving(false);
    }
  }

  function scrollToSection(id: (typeof sectionIds)[number]) {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const authenticationDescription = authProvider === "google"
    ? t.authenticationGoogle
    : authProvider === "email"
      ? t.authenticationEmail
      : authProvider === "loading"
        ? t.authenticationLoading
        : t.authenticationValue;

  return (
    <div className={`${styles.settingsPage} font-sans`}>
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <div className={styles.titleRow}>
            <h1>{t.title}</h1>
            <span className={styles.statusPill}><span className={styles.statusDot} />{t.ready}</span>
          </div>
          <p className={styles.description}>{t.description}</p>
        </div>
        <Button className={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saved && !saving ? <Check size={15} /> : <Save size={15} />}
          {saving ? t.saving : saved ? t.saved : t.save}
        </Button>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sectionNav} aria-label={t.overview}>
          <p className={styles.navLabel}>{t.overview}</p>
          {sectionIds.map((id) => {
            const labels = { language: t.language, security: t.security };
            const icons = { language: Languages, security: LockKeyhole };
            const Icon = icons[id];
            return (
              <button key={id} type="button" className={`${styles.navItem} ${activeSection === id ? styles.navItemActive : ""}`} onClick={() => scrollToSection(id)}>
                <Icon size={16} />
                <span>{labels[id]}</span>
                <ChevronRight size={14} className={styles.navArrow} />
              </button>
            );
          })}
          <div className={styles.navTip}>
            <Sparkles size={15} />
            <p>{t.tipDescription}</p>
          </div>
        </aside>

        <div className={styles.sections}>
          <Card className={styles.settingsCard} id="settings-language">
            <SectionHeading icon={Globe2} title={t.language} description={t.languageDescription} />
            <div className={styles.cardBody}>
              <div className={styles.languageRow}>
                <div>
                  <p className={styles.rowTitle}>{t.defaultLanguage}</p>
                  <p className={styles.rowDescription}>{t.fontHint}</p>
                </div>
                <div className={styles.languageSwitch} role="group" aria-label={t.defaultLanguage}>
                  <button type="button" className={locale === "th" ? styles.languageActive : ""} onClick={() => changeLocale("th")} aria-pressed={locale === "th"}>ไทย</button>
                  <button type="button" className={locale === "en" ? styles.languageActive : ""} onClick={() => changeLocale("en")} aria-pressed={locale === "en"}>English</button>
                </div>
              </div>
              <div className={styles.infoRow}><Info size={15} /><span>{t.font}: <strong>{t.fontValue}</strong></span></div>
            </div>
          </Card>

          <Card className={styles.settingsCard} id="settings-security">
            <SectionHeading icon={ShieldCheck} title={t.security} description={t.securityDescription} tone="pink" />
            <div className={styles.cardBody}>
              <SettingRow icon={KeyRound} title={t.authentication} description={authenticationDescription} value="✓" />
              <div className={styles.passwordPanel}>
                <div>
                  <p className={styles.rowTitle}>{t.password}</p>
                  <p className={styles.rowDescription}>{authProvider === "google" ? t.passwordManagedByGoogle : t.passwordDescription}</p>
                </div>
                {authProvider === "google" ? (
                  <p className={styles.passwordGoogleNote} role="status">{t.passwordManagedByGoogle}</p>
                ) : authProvider === "loading" ? (
                  <p className={styles.passwordGoogleNote} role="status">{t.authenticationLoading}</p>
                ) : (
                  <form className={styles.passwordForm} onSubmit={handleChangePassword}>
                    <label>{t.currentPassword}<input type="password" autoComplete="current-password" required value={passwordForm.current} onChange={(event) => setPasswordForm((current) => ({ ...current, current: event.target.value }))} /></label>
                    <label>{t.newPassword}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.next} onChange={(event) => setPasswordForm((current) => ({ ...current, next: event.target.value }))} /></label>
                    <label>{t.confirmPassword}<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.confirm} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm: event.target.value }))} /></label>
                    <Button type="submit" variant="outline" size="sm" className={styles.passwordButton} disabled={passwordSaving}>{passwordSaving ? t.changingPassword : t.changePassword}</Button>
                    {passwordMessage ? <p className={passwordMessage.tone === "success" ? styles.passwordSuccess : styles.passwordError} role="status">{passwordMessage.text}</p> : null}
                  </form>
                )}
              </div>
              <SettingRow icon={Monitor} title={t.activeSessions} description={t.activeSessionsValue}>
                <Button variant="outline" size="sm" className={styles.rowButton}>{t.reviewSessions}</Button>
              </SettingRow>
            </div>
          </Card>

          {showNotificationSettings && <Card className={styles.settingsCard} id="settings-notifications">
            <SectionHeading icon={Bell} title={t.notifications} description={t.notificationsDescription} tone="yellow" />
            <div className={styles.cardBody}>
              <SettingRow icon={Mail} title={t.emailUpdates} description={t.emailUpdatesHint}>
                <Toggle checked={notifications.email} label={t.emailUpdates} onChange={() => setNotifications((current) => ({ ...current, email: !current.email }))} />
              </SettingRow>
              <SettingRow icon={Sparkles} title={t.projectActivity} description={t.projectActivityHint}>
                <Toggle checked={notifications.project} label={t.projectActivity} onChange={() => setNotifications((current) => ({ ...current, project: !current.project }))} />
              </SettingRow>
              <SettingRow icon={LockKeyhole} title={t.securityAlerts} description={t.securityAlertsHint}>
                <Toggle checked={notifications.security} label={t.securityAlerts} onChange={() => setNotifications((current) => ({ ...current, security: !current.security }))} />
              </SettingRow>
            </div>
          </Card>}

          <div className={styles.helpRow}><span>{t.help}</span><a href="mailto:support@eoslabs.tech">{t.helpLink}<ChevronRight size={14} /></a></div>
        </div>
      </div>
    </div>
  );
}
