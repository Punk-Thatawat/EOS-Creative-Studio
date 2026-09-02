"use client";

import { Captions, Check, Maximize, Pause, Play, RotateCcw, RotateCw, Settings, Volume2, VolumeX } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";

function formatVideoDuration(duration: number): string {
  if (!Number.isFinite(duration)) return "--:--";
  const totalSeconds = Math.max(0, Math.round(duration));
  return `${Math.floor(totalSeconds / 60).toString().padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

export function EosVideoPlayer({
  src,
  className = "",
  autoPlay = false,
  muted: initialMuted = true,
  onEnded,
  ariaLabel = "Video player",
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  ariaLabel?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(!autoPlay);
  const [muted, setMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [videoResolution, setVideoResolution] = useState<string | null>(null);
  const [playbackFeedback, setPlaybackFeedback] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  const [isPointerOverVideo, setIsPointerOverVideo] = useState(true);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const pointerOverVideoRef = useRef(true);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };
  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    const feedbackType = video.paused ? "play" : "pause";
    togglePlay();
    if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
    setPlaybackFeedback({ type: feedbackType, id: Date.now() });
    feedbackTimeoutRef.current = window.setTimeout(() => setPlaybackFeedback(null), 720);
  };
  const updatePointerOverVideo = (isOver: boolean) => {
    if (pointerOverVideoRef.current === isOver) return;
    pointerOverVideoRef.current = isOver;
    setIsPointerOverVideo(isOver);
  };
  const handlePlayerPointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const controls = event.currentTarget.querySelector<HTMLElement>(".intro-video-controls");
    if (!video) return;

    const videoRect = video.getBoundingClientRect();
    const controlsRect = controls?.getBoundingClientRect();
    const isInsideVideo = event.clientX >= videoRect.left && event.clientX <= videoRect.right
      && event.clientY >= videoRect.top && event.clientY <= videoRect.bottom;
    const isInsideControls = controlsRect
      ? event.clientX >= controlsRect.left && event.clientX <= controlsRect.right
        && event.clientY >= controlsRect.top && event.clientY <= controlsRect.bottom
      : false;
    const isInsidePlayer = isInsideVideo || isInsideControls;
    updatePointerOverVideo(isInsidePlayer);
    if (video.paused === false) {
      setAreControlsVisible(isInsideControls);
      return;
    }
    if (isInsidePlayer) {
      setAreControlsVisible(true);
    }
  };
  const seek = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + amount));
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      const nextVolume = volume > 0 ? volume : 1;
      video.volume = nextVolume;
      video.muted = false;
      setVolume(nextVolume);
      setMuted(false);
      return;
    }
    video.muted = true;
    setMuted(true);
  };
  const changeVolume = (nextVolume: number) => {
    const video = videoRef.current;
    setVolume(nextVolume);
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setMuted(video.muted);
  };
  const toggleFullscreen = () => {
    const target = videoRef.current?.parentElement;
    if (!target) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void target.requestFullscreen?.().catch(() => undefined);
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setIsSettingsOpen(false);
  };

  return (
    <div className={`intro-video-player-wrap ${!paused ? "intro-video-is-playing" : ""} ${isPointerOverVideo ? "intro-video-pointer-over" : ""} ${areControlsVisible ? "intro-video-controls-visible" : ""} ${className}`} onMouseMove={handlePlayerPointerMove} onMouseLeave={() => { updatePointerOverVideo(false); if (!videoRef.current?.paused) setAreControlsVisible(false); }}>
      <video
        ref={videoRef}
        className="video-modal-player"
        src={src}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        aria-label={ariaLabel}
        onClick={handleVideoClick}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          event.currentTarget.playbackRate = playbackRate;
          setVideoResolution(event.currentTarget.videoWidth && event.currentTarget.videoHeight
            ? `${event.currentTarget.videoWidth} × ${event.currentTarget.videoHeight}`
            : null);
        }}
        onLoadedData={(event) => {
          event.currentTarget.muted = muted;
          event.currentTarget.volume = volume;
          if (autoPlay) void event.currentTarget.play().catch(() => undefined);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPaused(false);
          setAreControlsVisible(true);
        }}
        onPause={() => {
          setPaused(true);
          setAreControlsVisible(true);
        }}
        onEnded={() => {
          setPaused(true);
          setAreControlsVisible(true);
          onEnded?.();
        }}
      />
      {playbackFeedback ? (
        <span key={playbackFeedback.id} className="intro-video-play-feedback" aria-hidden="true">
          {playbackFeedback.type === "play" ? <Play size={42} fill="currentColor" /> : <Pause size={42} fill="currentColor" />}
        </span>
      ) : null}
      <div className="intro-video-controls" onClick={(event) => event.stopPropagation()}>
        <div className="intro-video-progress" style={{ "--intro-video-progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties}>
          <div className="intro-video-progress-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={(event) => {
              const nextTime = Number(event.currentTarget.value);
              setCurrentTime(nextTime);
              if (videoRef.current) videoRef.current.currentTime = nextTime;
            }}
            aria-label="Video progress"
          />
        </div>
        <div className="intro-video-control-row">
          <div className="intro-video-volume-control">
            <button type="button" className="intro-video-icon-button" aria-label={muted ? "Unmute video" : "Mute video"} onClick={toggleMute}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(event) => changeVolume(Number(event.currentTarget.value))}
            />
          </div>
          <div className="intro-video-center-controls">
            <div className="intro-video-transport">
              <button type="button" className="intro-video-icon-button intro-video-skip" aria-label="Rewind 10 seconds" onClick={() => seek(-10)}><RotateCcw size={17} /><span>10</span></button>
              <button type="button" className="intro-video-play-button" aria-label={paused ? "Play video" : "Pause video"} onClick={togglePlay}>{paused ? <Play size={21} fill="white" /> : <Pause size={21} />}</button>
              <button type="button" className="intro-video-icon-button intro-video-skip" aria-label="Forward 10 seconds" onClick={() => seek(10)}><RotateCw size={17} /><span>10</span></button>
            </div>
            <span className="intro-video-time">{formatVideoDuration(currentTime)} / {formatVideoDuration(duration)}</span>
          </div>
          <div className="intro-video-extra-controls">
            <button type="button" className="intro-video-icon-button" aria-label="Captions"><Captions size={16} /></button>
            <div className="intro-video-settings">
              {isSettingsOpen ? (
                <div className="intro-video-settings-popover" role="dialog" aria-label="Video settings">
                  <strong>Quality</strong>
                  <div className="intro-video-quality-value">
                    <span>Source quality</span>
                    <small>{videoResolution ?? "Auto"}</small>
                  </div>
                  <strong>Playback speed</strong>
                  {[0.5, 1, 1.5, 2].map((rate) => (
                    <button key={rate} type="button" onClick={() => changePlaybackRate(rate)}>
                      <span>{rate}x</span>
                      {playbackRate === rate ? <Check size={14} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              <button type="button" className="intro-video-icon-button" aria-label="Video settings" aria-expanded={isSettingsOpen} onClick={() => setIsSettingsOpen((open) => !open)}><Settings size={17} /></button>
            </div>
            <button type="button" className="intro-video-icon-button" aria-label="Fullscreen" onClick={toggleFullscreen}><Maximize size={17} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
