"use client";

import { Trash2 } from "lucide-react";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import { MobileModeDropdown } from "@/features/create/components/mobile-mode-dropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  audioModeIcons,
  audioTabKeys,
  mobileAudioModeOptions,
  visibleTabs,
} from "./audio-generation.constants";
import { PodcastDialogueLayout } from "./podcast-dialogue-layout";
import { VoiceCloneLayout } from "./voice-clone-layout";
import { SoundEffectsLayout } from "./sound-effects-layout";
import { TextToMusicLayout } from "./text-to-music-layout";
import { AudioCleanupLayout } from "./audio-cleanup-layout";
import Image from "next/image";
import styles from "./audio-generation-page.module.css";
import { useAudioGeneration } from "./use-audio-generation";
import { TextToSpeechLayout } from "./text-to-speech-layout";

export function AudioGenerationPage() {
  const audio = useAudioGeneration();
  const {
    activeTab,
    tabBodyMinHeight,
    pendingHistoryDelete,
    setPendingHistoryDelete,
    historyDeleteOpen,
    setHistoryDeleteOpen,
    tabBodyRef,
    changeActiveTab,
    openClonedVoiceInTextToSpeech,
    persistGeneratedAudio,
    removeHistoryItem,
    t,
  } = audio;

  return (
    <div className={`${styles.audioPage} audio-studio-page`}>
      <section className={`studio-hero-frame ${styles.heroBanner}`} aria-label={t("create.audio.a11y.hero")}>
        <picture>
          <source
            media="(max-width: 767.98px)"
            srcSet="/generated-assets/studio-heroes-v4/create-audio-mobile-v2.webp"
          />
          <Image
            src="/generated-assets/studio-heroes-v4/create-audio-desktop-v2.webp"
            alt="Gen Audio — AI audio generation studio"
            width={2400}
            height={435}
            priority
            sizes="100vw"
          />
        </picture>
      </section>

      <CreatorWorkspaceLayout
        tabs={
          <nav className={styles.featureTabs} aria-label={t("create.audio.tools")}>
            {visibleTabs.map((label) => {
              const TabIcon = audioModeIcons[label];
              return (
                <button
                  key={label}
                  type="button"
                  className={activeTab === label ? styles.tabActive : styles.tab}
                  onClick={() => changeActiveTab(label)}
                  aria-pressed={activeTab === label}
                >
                  <TabIcon size={16} aria-hidden="true" />
                  {t(audioTabKeys[label])}
                </button>
              );
            })}
          </nav>
        }
        mobileTabs={
          <MobileModeDropdown
            menuId="audio-mode-menu"
            value={activeTab}
            options={mobileAudioModeOptions.map((option) => ({
              ...option,
              label: t(audioTabKeys[option.value]),
            }))}
            ariaLabel={t("create.audio.tools")}
            currentModeLabel={t("create.mode.current")}
            switchModeLabel={t("create.mode.switch")}
            otherModesLabel={t("create.mode.other")}
            onChange={(nextTab) => {
              if (nextTab !== activeTab) changeActiveTab(nextTab);
            }}
          />
        }
        content={
          <div ref={tabBodyRef} className={styles.tabBody} style={tabBodyMinHeight ? { minHeight: tabBodyMinHeight } : undefined}>
            {activeTab === "Text to Speech" ? (
              <TextToSpeechLayout audio={audio} />
            ) : activeTab === "Podcast & Dialogue" ? (
              <PodcastDialogueLayout onHistorySaved={persistGeneratedAudio} />
            ) : activeTab === "Voice Clone" ? (
              <VoiceCloneLayout
                onHistorySaved={persistGeneratedAudio}
                onOpenInTextToSpeech={openClonedVoiceInTextToSpeech}
              />
            ) : activeTab === "Sound Effects" ? (
              <SoundEffectsLayout onHistorySaved={persistGeneratedAudio} />
            ) : activeTab === "Text to Music" ? (
              <TextToMusicLayout />
            ) : (
              <AudioCleanupLayout />
            )}
          </div>
        }
      />
      <Dialog
        open={historyDeleteOpen}
        onOpenChange={(next) => {
          if (!next) setHistoryDeleteOpen(false);
        }}
        onOpenChangeComplete={(next) => {
          if (!next) setPendingHistoryDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("create.audio.deleteHistory.title")}</DialogTitle>
            <DialogDescription>
              {t("create.audio.deleteHistory.body", { label: pendingHistoryDelete?.label ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryDeleteOpen(false)}>
              {t("create.audio.deleteHistory.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingHistoryDelete) removeHistoryItem(pendingHistoryDelete);
                setHistoryDeleteOpen(false);
              }}
            >
              <Trash2 size={15} /> {t("create.audio.deleteHistory.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
