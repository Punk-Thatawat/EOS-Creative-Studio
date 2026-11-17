import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Check, ChevronDown, Pause, Play, Search } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AudioVoice } from "@/lib/api/audio";
import Image from "next/image";
import styles from "./audio-generation-page.module.css";
import { getPodcastVoiceAvatar } from "./audio-generation.helpers";

export function PodcastVoicePicker({ voices, value, onChange, loading, playingKey, loadingKey, onPreview, onClose }: {
  voices: AudioVoice[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  playingKey: string | null;
  loadingKey: string | null;
  onPreview: (voice: AudioVoice) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = voices.find((voice) => voice.key === value || voice.name === value);
  const filtered = voices.filter((voice) => `${voice.name} ${voice.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const close = useCallback(() => { setOpen(false); setSearch(""); onClose(); }, [onClose]);

  useEffect(() => () => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open, close]);

  const avatar = (voice: AudioVoice | undefined) => {
    const image = getPodcastVoiceAvatar(voice);
    return <span className={styles.podcastVoicePickerAvatar}>{image ? <Image src={image} alt="" fill unoptimized sizes="44px" /> : <AudioLines size={17} />}</span>;
  };

  return <div className={styles.podcastVoicePicker} ref={rootRef}>
    <button ref={triggerRef} type="button" className={styles.podcastVoicePickerTrigger} disabled={loading || !voices.length} aria-label="เลือกเสียงผู้พูด" aria-haspopup="dialog" aria-expanded={open} onClick={() => open ? close() : setOpen(true)}>
      {avatar(selected)}<strong>{loading ? "กำลังโหลดเสียง…" : selected?.name ?? "เลือกเสียงผู้พูด"}</strong><ChevronDown size={16} className={open ? styles.podcastVoicePickerChevronOpen : undefined} />
    </button>
    {open ? <div className={styles.podcastVoicePickerMenu} role="dialog" aria-label="เลือกเสียงผู้พูด">
      <div className={styles.podcastVoicePickerSearch}><Search size={17} aria-hidden="true" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเสียง" aria-label="ค้นหาเสียง" /></div>
      <div className={styles.podcastVoicePickerList}>
        {filtered.length ? filtered.map((voice) => {
          const chosen = voice.key === selected?.key;
          const playing = playingKey === voice.key;
          return <div key={voice.key} className={`${styles.podcastVoicePickerOption} ${chosen ? styles.podcastVoicePickerOptionSelected : ""}`}>
            <button type="button" className={styles.podcastVoicePickerChoose} aria-pressed={chosen} onClick={() => { onChange(voice.key); close(); triggerRef.current?.focus(); }}>
              {avatar(voice)}<span className={styles.podcastVoicePickerCopy}><strong>{voice.name}</strong><small>{voice.description || "เสียงพอดแคสต์"}</small></span>{chosen ? <Check size={16} aria-label="เลือกอยู่" /> : null}
            </button>
            <button type="button" className={styles.podcastVoicePickerPlay} disabled={loadingKey !== null} onClick={() => onPreview(voice)} aria-label={`${playing ? "หยุด" : "ฟัง"}ตัวอย่างเสียง ${voice.name}`}>
              {loadingKey === voice.key ? <span className={styles.voicePreviewSpinner} /> : playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </button>
          </div>;
        }) : <p className={styles.podcastVoicePickerEmpty}>ไม่พบเสียงที่ค้นหา</p>}
      </div>
    </div> : null}
  </div>;
}

export function PodcastConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.podcastConfirmDialog}>
        <DialogHeader className={styles.podcastConfirmHeader}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className={styles.podcastConfirmFooter}>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("create.audio.podcast.confirm.cancel")}
          </Button>
          <Button type="button" variant="destructive" className={styles.podcastConfirmDeleteButton} onClick={onConfirm}>
            {t("create.audio.podcast.confirm.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutoGrowPodcastLineInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={inputRef}
      className={styles.podcastLineInput}
      rows={1}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
    />
  );
}
