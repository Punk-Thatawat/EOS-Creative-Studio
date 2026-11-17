import { type ReactNode } from "react";
import { InfoTooltip } from "@/features/create/components/info-tooltip";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import Image from "next/image";
import styles from "./audio-generation-page.module.css";
import { audioSettingInfo, waveformBars } from "./audio-generation.constants";

export function AudioSettingLabel({ label }: { label: string }) {
  const { t } = useLocale();
  const entry = audioSettingInfo.find(([key]) => t(key) === label);
  return <>{label}{entry ? <> <InfoTooltip content={t(entry[1])} size={11} /></> : null}</>;
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className={styles.fieldLabel}>
      <span>{typeof children === "string" ? <AudioSettingLabel label={children} /> : children}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  disabled = false,
  loading = false,
}: {
  label: string;
  options: readonly DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={styles.selectField}>
      <FieldLabel>{label}</FieldLabel>
      <Dropdown
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        loading={loading}
        ariaLabel={label}
        triggerClassName="h-[38px] min-h-0 rounded-lg border-[#dfe2e7] px-[11px] text-[11px] font-normal"
      />
    </div>
  );
}

export function PreviewWaveform({
  audioUrl,
  progress,
  isPlaying,
}: {
  audioUrl: string | null;
  progress: number;
  isPlaying: boolean;
}) {
  const { t } = useLocale();
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div
      className={`${styles.waveform} ${isPlaying ? styles.waveformPlaying : ""}`}
      aria-label={t("create.audio.a11y.waveform")}
    >
      <div className={styles.waveformBars} aria-hidden="true">
        {waveformBars.map((height, index) => {
          const barProgress = (index / Math.max(1, waveformBars.length - 1)) * 100;
          return (
            <span
              key={`${height}-${index}`}
              className={`${styles.waveformBar} ${audioUrl && barProgress <= safeProgress ? styles.waveformBarPlayed : ""}`}
              style={{
                height: `${height}%`,
                animationDelay: `${(index % 12) * -75}ms`,
                animationDuration: `${0.86 + (index % 5) * 0.08}s`,
              }}
            />
          );
        })}
      </div>
      {audioUrl ? (
        <span className={styles.waveformPlayhead} style={{ left: `${safeProgress}%` }} aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function AlternateHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className={styles.alternateHeading}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.alternateHeadingIcon}>{icon}</div>
    </div>
  );
}

export function AltWaveform({ label = "LIVE PREVIEW" }: { label?: string }) {
  return (
    <div className={styles.altWaveform}>
      <Image src="/generated-assets/audio-ui/audio-waveform.png" alt="" fill unoptimized sizes="700px" />
      <span>{label}</span>
    </div>
  );
}
