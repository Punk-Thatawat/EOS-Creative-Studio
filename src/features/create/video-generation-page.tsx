"use client";

import { TextToVideoWorkspace } from "./text-video-generation";
import { PeopleVideoWorkspace } from "./people-video-generation";
import { MotionTransferWorkspace } from "./motion-transfer-generation";
import { ExtendVideoWorkspace } from "./extend-video-generation";
import { MobileModeDropdown } from "./components/mobile-mode-dropdown";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import {
  mobileVideoModeOptions,
  videoModeIcons,
  videoModes,
  videoTabKeys,
  videoTabValues,
} from "./video-generation.constants";
import Image from "next/image";
import styles from "./video-generation-page.module.css";
import { useVideoGenerationPage } from "./use-video-generation-page";
import { VideoLeftPanel } from "./video-left-panel";
import { VideoPreviewPanel } from "./video-preview-panel";
import { VideoSettingsPanel } from "./video-settings-panel";
import { SceneModal } from "./scene-modal";
import { DeleteSceneDialog } from "./delete-scene-dialog";

export function VideoGenerationPage() {
  const videoGen = useVideoGenerationPage();
  const {
    activeVideoTab,
    visitedVideoTabs,
    notice,
    isSceneModalOpen,
    deleteSceneIndex,
    initialPeopleVideoVariant,
    selectVideoTab,
    t,
  } = videoGen;

  return (
    <div className={styles.page} data-page="gen-video">
      <div className={`${styles.hero} studio-hero-frame`}>
        <picture>
          <source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/create-video-mobile.webp" />
        <Image
          src="/generated-assets/studio-heroes-v4/create-video-desktop.webp"
          alt={t("create.video.common.createVideoHeroAlt")}
          fill
          sizes="100vw"
        />
        </picture>
      </div>
      <CreatorWorkspaceLayout
        notice={notice ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
            {notice}
          </div>
        ) : undefined}
        tabs={<nav className={styles.tabs} aria-label={t("create.video.tools")}>
          {videoModes.map((label) => {
            const tab = videoTabValues[label];
            const isActive = activeVideoTab === tab;
            const TabIcon = videoModeIcons[label];
            return (
              <button
                key={label}
                type="button"
                className={isActive ? styles.active : undefined}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  if (tab && tab !== activeVideoTab) {
                    selectVideoTab(tab);
                  }
                }}
              >
                <TabIcon size={16} aria-hidden="true" />
                {t(videoTabKeys[label])}
              </button>
            );
          })}
        </nav>}
        mobileTabs={<MobileModeDropdown
          menuId="video-mode-menu"
          value={activeVideoTab}
          options={mobileVideoModeOptions.map((option) => ({ ...option, label: t(videoTabKeys[option.label]) }))}
          ariaLabel={t("create.video.tools")}
          currentModeLabel={t("create.mode.current")}
          switchModeLabel={t("create.mode.switch")}
          otherModesLabel={t("create.mode.other")}
          onChange={(tab) => {
            if (tab !== activeVideoTab) {
              selectVideoTab(tab);
            }
          }}
        />}
        content={activeVideoTab !== "image-to-video" ? (
          <>
            {visitedVideoTabs.has("text-to-video") ? <div hidden={activeVideoTab !== "text-to-video"}><TextToVideoWorkspace /></div> : null}
            {visitedVideoTabs.has("people-video") ? <div hidden={activeVideoTab !== "people-video"}><PeopleVideoWorkspace initialVariant={initialPeopleVideoVariant} /></div> : null}
            {visitedVideoTabs.has("motion-transfer") ? <div hidden={activeVideoTab !== "motion-transfer"}><MotionTransferWorkspace /></div> : null}
            {visitedVideoTabs.has("extend-video") ? <div hidden={activeVideoTab !== "extend-video"}><ExtendVideoWorkspace /></div> : null}
          </>
        ) : undefined}
        left={activeVideoTab === "image-to-video" ? (
          <VideoLeftPanel videoGen={videoGen} />
        ) : undefined}
        preview={activeVideoTab === "image-to-video" ? (
          <VideoPreviewPanel videoGen={videoGen} />
        ) : undefined}
        right={activeVideoTab === "image-to-video" ? (
          <VideoSettingsPanel videoGen={videoGen} />
        ) : undefined}
      />
      {isSceneModalOpen ? (
        <SceneModal videoGen={videoGen} />
      ) : null}
      {deleteSceneIndex !== null ? (
        <DeleteSceneDialog videoGen={videoGen} />
      ) : null}
    </div>
  );
}
