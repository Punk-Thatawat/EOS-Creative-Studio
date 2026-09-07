"use client";

import { useMemo, useState } from "react";
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
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getApiAccessToken } from "@/lib/auth/access-token";
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
  workspace: "settings.workspace",
  workspaceDescription: "settings.workspaceDescription",
  workspaceName: "settings.workspaceName",
  workspaceNameValue: "settings.workspaceNameValue",
  defaultProject: "settings.defaultProject",
  defaultProjectValue: "settings.defaultProjectValue",
  defaultProjectHint: "settings.defaultProjectHint",
  security: "settings.security",
  securityDescription: "settings.securityDescription",
  authentication: "settings.authentication",
  authenticationValue: "settings.authenticationValue",
  activeSessions: "settings.activeSessions",
  activeSessionsValue: "settings.activeSessionsValue",
  reviewSessions: "settings.reviewSessions",
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

const sectionIds = ["language", "workspace", "security"] as const;
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

  const t: Copy = useMemo(
    () => Object.fromEntries(Object.entries(settingsKeys).map(([name, key]) => [name, translateKey(key as TranslationKey)])) as Copy,
    [translateKey],
  );

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

  function scrollToSection(id: (typeof sectionIds)[number]) {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
            const labels = { language: t.language, workspace: t.workspace, security: t.security, notifications: t.notifications };
            const icons = { language: Languages, workspace: Settings2, security: LockKeyhole, notifications: Bell };
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

          <Card className={styles.settingsCard} id="settings-workspace">
            <SectionHeading icon={Settings2} title={t.workspace} description={t.workspaceDescription} tone="orange" />
            <div className={styles.cardBody}>
              <label className={styles.fieldLabel} htmlFor="workspace-name">{t.workspaceName}</label>
              <Input id="workspace-name" defaultValue={t.workspaceNameValue} className={styles.fieldInput} />
              <div className={styles.preferenceRow}>
                <div><p className={styles.rowTitle}>{t.defaultProject}</p><p className={styles.rowDescription}>{t.defaultProjectHint}</p></div>
                <span className={styles.preferenceValue}>{t.defaultProjectValue}</span>
              </div>
            </div>
          </Card>

          <Card className={styles.settingsCard} id="settings-security">
            <SectionHeading icon={ShieldCheck} title={t.security} description={t.securityDescription} tone="pink" />
            <div className={styles.cardBody}>
              <SettingRow icon={KeyRound} title={t.authentication} description={t.authenticationValue} value="✓" />
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

          <div className={styles.helpRow}><span>{t.help}</span><button type="button">{t.helpLink}<ChevronRight size={14} /></button></div>
        </div>
      </div>
    </div>
  );
}
