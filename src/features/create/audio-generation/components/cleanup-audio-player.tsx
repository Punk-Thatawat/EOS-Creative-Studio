import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./audio-generation-page.module.css";
import { formatSceneSeconds } from "./audio-generation.helpers";
import { PreviewWaveform } from "./audio-shared-parts";

export function CleanupAudioPlayer({ src, label, playRequest = 0 }: { src: string | null; label: string; playRequest?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlayRequestRef = useRef(playRequest);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(78);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const { t } = useLocale();

  useEffect(() => {
    audioRef.current?.pause();
    const timer = window.setTimeout(() => {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [src]);

  useEffect(() => {
    if (!src || playRequest === lastPlayRequestRef.current) return;
    lastPlayRequestRef.current = playRequest;
    void audioRef.current?.play().catch(() => undefined);
  }, [src, playRequest]);

  const togglePlayback = async () => {
    if (!audioRef.current || !src) return;
    if (audioRef.current.paused) {
      await audioRef.current.play().catch(() => undefined);
    } else {
      audioRef.current.pause();
    }
  };

  const seekBy = (seconds: number) => {
    if (!audioRef.current || duration <= 0) return;
    const nextTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className={styles.cleanupPlayer} role="group" aria-label={label}>
      <div className={styles.cleanupPlayerWaveform}>
        <PreviewWaveform audioUrl={src} progress={progress} isPlaying={isPlaying} />
      </div>
      <div className={`${styles.playerRow} ${styles.cleanupPlayerControls}`}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => void togglePlayback()}
          disabled={!src}
          aria-label={t(isPlaying ? "create.audio.a11y.pause" : "create.audio.a11y.play")}
        >
          {isPlaying ? <span className={styles.pauseGlyph} /> : <Play size={20} fill="currentColor" />}
        </button>
        <button
          type="button"
          className={styles.skipButton}
          onClick={() => seekBy(-10)}
          disabled={!src || duration <= 0}
          aria-label={t("create.audio.a11y.rewind10")}
        >
          <RotateCcw size={17} aria-hidden="true" /><small>10</small>
        </button>
        <button
          type="button"
          className={styles.skipButton}
          onClick={() => seekBy(10)}
          disabled={!src || duration <= 0}
          aria-label={t("create.audio.a11y.forward10")}
        >
          <RotateCw size={17} aria-hidden="true" /><small>10</small>
        </button>
        <span className={styles.timeLabel}>
          {formatSceneSeconds(currentTime)} / {formatSceneSeconds(duration)}
        </span>
        <input
          className={styles.scrubber}
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          onChange={(event) => {
            const nextProgress = Number(event.target.value);
            if (audioRef.current && duration > 0) {
              const nextTime = (nextProgress / 100) * duration;
              audioRef.current.currentTime = nextTime;
              setCurrentTime(nextTime);
            }
          }}
          aria-label={t("create.audio.a11y.audioProgress")}
          disabled={!src || duration <= 0}
        />
        <Volume2 size={17} className={styles.volumeIcon} aria-hidden="true" />
        <input
          className={styles.volumeSlider}
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => {
            const nextVolume = Number(event.target.value);
            setVolume(nextVolume);
            if (audioRef.current) audioRef.current.volume = nextVolume / 100;
          }}
          aria-label={t("create.audio.a11y.volume")}
          disabled={!src}
        />
      </div>
      <audio
        ref={audioRef}
        className={styles.podcastNativeAudio}
        src={src ?? undefined}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          event.currentTarget.volume = volume / 100;
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
      />
    </div>
  );
}
