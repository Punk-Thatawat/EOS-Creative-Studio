"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  workspaceApiKeysApi,
  type CreatedWorkspaceApiKey,
  type WorkspaceApiKey,
  type WorkspaceApiKeysApi,
} from "@/lib/api/workspace-api-keys";
import { useLocale, type Locale } from "@/lib/i18n/locale-provider";
import settingsStyles from "./settings-page.module.css";
import styles from "./api-keys-section.module.css";

export const API_KEYS_SECTION_ID = "settings-apikeys";

const MAX_NAME_LENGTH = 80;

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** A date picked in the form means "until the end of that day", in the browser's time zone. */
function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59`).toISOString();
}

function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Create, list and revoke the API keys of the signed-in user's workspace. A key lets another application (for example
 * workspace.eoslabs.tech) call the API from its own server. The full key is shown once, right after it is created.
 * `api` can be replaced to render the section without a backend.
 */
export function ApiKeysSection({ api = workspaceApiKeysApi }: { api?: WorkspaceApiKeysApi }) {
  const { locale, t } = useLocale();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [keys, setKeys] = useState<WorkspaceApiKey[]>([]);
  const [name, setName] = useState("");
  const [expiresDay, setExpiresDay] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedWorkspaceApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const result = await api.load();
      setWorkspaceId(result.workspaceId);
      setKeys(result.keys);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [api]);

  useEffect(() => {
    let active = true;
    void api
      .load()
      .then((result) => {
        if (!active) return;
        setWorkspaceId(result.workspaceId);
        setKeys(result.keys);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.create(workspaceId, {
        name: name.trim(),
        ...(expiresDay ? { expiresAt: endOfDayIso(expiresDay) } : {}),
      });
      const { key: _secret, ...stored } = created;
      void _secret;
      setCreatedKey(created);
      setCopied(false);
      setKeys((current) => [stored, ...current]);
      setName("");
      setExpiresDay("");
    } catch (error: unknown) {
      setCreateError(error instanceof Error && error.message ? error.message : t("settings.apiKeys.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
    } catch {
      // The key stays selectable in the field below if the browser refuses clipboard access.
    }
  }

  async function handleRevoke(key: WorkspaceApiKey) {
    if (!workspaceId) return;
    setRevokingId(key.id);
    setRevokeError(null);
    try {
      await api.revoke(workspaceId, key.id);
      setKeys((current) =>
        current.map((item) =>
          item.id === key.id ? { ...item, status: "revoked", revokedAt: new Date().toISOString() } : item,
        ),
      );
      setConfirmRevokeId(null);
    } catch (error: unknown) {
      setRevokeError(error instanceof Error && error.message ? error.message : t("settings.apiKeys.revokeFailed"));
    } finally {
      setRevokingId(null);
    }
  }

  const statusLabel = {
    active: t("settings.apiKeys.statusActive"),
    expired: t("settings.apiKeys.statusExpired"),
    revoked: t("settings.apiKeys.statusRevoked"),
  } as const;

  return (
    <Card className={settingsStyles.settingsCard} id={API_KEYS_SECTION_ID}>
      <div className={settingsStyles.sectionHeading}>
        <span className={`${settingsStyles.sectionIcon} ${settingsStyles.toneorange}`}>
          <KeyRound size={18} strokeWidth={1.9} />
        </span>
        <div>
          <h2>{t("settings.apiKeys.title")}</h2>
          <p>{t("settings.apiKeys.description")}</p>
        </div>
      </div>
      <div className={settingsStyles.cardBody}>
        <ul className={styles.notes}>
          <li>{t("settings.apiKeys.noteCredits")}</li>
          <li>{t("settings.apiKeys.noteServerOnly")}</li>
        </ul>

        {createdKey ? (
          <div className={styles.created} role="status">
            <p className={styles.createdTitle}>
              <TriangleAlert size={16} aria-hidden="true" />
              {t("settings.apiKeys.createdTitle", { name: createdKey.name })}
            </p>
            <p className={styles.createdWarning}>{t("settings.apiKeys.createdWarning")}</p>
            <div className={styles.keyRow}>
              <input
                className={styles.keyField}
                readOnly
                value={createdKey.key}
                aria-label={t("settings.apiKeys.keyLabel")}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCopy();
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? t("settings.apiKeys.copied") : t("settings.apiKeys.copy")}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className={styles.dismiss}
              onClick={() => {
                setCreatedKey(null);
                setCopied(false);
              }}
            >
              {t("settings.apiKeys.dismiss")}
            </Button>
          </div>
        ) : null}

        <form className={styles.form} onSubmit={handleCreate}>
          <label>
            {t("settings.apiKeys.nameLabel")}
            <input
              value={name}
              maxLength={MAX_NAME_LENGTH}
              required
              placeholder={t("settings.apiKeys.namePlaceholder")}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            {t("settings.apiKeys.expiresLabel")}
            <input
              type="date"
              value={expiresDay}
              min={todayInputValue()}
              onChange={(event) => setExpiresDay(event.target.value)}
            />
            <span className={styles.hint}>{t("settings.apiKeys.expiresHint")}</span>
          </label>
          <Button
            type="submit"
            size="sm"
            className={styles.submit}
            disabled={creating || loadState !== "ready" || !name.trim()}
          >
            {creating ? t("settings.apiKeys.creating") : t("settings.apiKeys.create")}
          </Button>
          <p className={styles.hint}>{t("settings.apiKeys.limitHint")}</p>
          {createError ? (
            <p className={styles.error} role="alert">
              {createError}
            </p>
          ) : null}
        </form>

        <div className={styles.listHeader}>
          <h3>{t("settings.apiKeys.listTitle")}</h3>
        </div>
        {loadState === "loading" ? (
          <p className={styles.state} role="status">
            {t("settings.apiKeys.loading")}
          </p>
        ) : loadState === "error" ? (
          <div className={styles.state} role="alert">
            <p>{t("settings.apiKeys.loadFailed")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void load();
              }}
            >
              {t("settings.apiKeys.retry")}
            </Button>
          </div>
        ) : keys.length === 0 ? (
          <p className={styles.state}>{t("settings.apiKeys.empty")}</p>
        ) : (
          <ul className={styles.list}>
            {keys.map((key) => (
              <li key={key.id} className={`${styles.item} ${key.status === "active" ? "" : styles.itemInactive}`}>
                <div className={styles.itemCopy}>
                  <p className={styles.itemName}>
                    <strong>{key.name}</strong>
                    <span className={`${styles.badge} ${styles[`badge_${key.status}`]}`}>
                      {statusLabel[key.status]}
                    </span>
                  </p>
                  <p className={styles.itemKey}>{key.keyPrefix}…</p>
                  <p className={styles.itemMeta}>
                    {t("settings.apiKeys.createdAt")}: {formatDate(key.createdAt, locale)} ·{" "}
                    {t("settings.apiKeys.lastUsed")}:{" "}
                    {key.lastUsedAt ? formatDate(key.lastUsedAt, locale) : t("settings.apiKeys.neverUsed")} ·{" "}
                    {t("settings.apiKeys.expires")}:{" "}
                    {key.expiresAt ? formatDate(key.expiresAt, locale) : t("settings.apiKeys.neverExpires")}
                  </p>
                </div>
                {key.status === "active" ? (
                  confirmRevokeId === key.id ? (
                    <div className={styles.confirm}>
                      <p>{t("settings.apiKeys.revokeHint")}</p>
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          className={styles.danger}
                          disabled={revokingId === key.id}
                          onClick={() => {
                            void handleRevoke(key);
                          }}
                        >
                          {revokingId === key.id ? t("settings.apiKeys.revoking") : t("settings.apiKeys.revokeConfirm")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revokingId === key.id}
                          onClick={() => setConfirmRevokeId(null)}
                        >
                          {t("settings.apiKeys.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRevokeError(null);
                        setConfirmRevokeId(key.id);
                      }}
                    >
                      {t("settings.apiKeys.revoke")}
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {revokeError ? (
          <p className={styles.error} role="alert">
            {revokeError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
