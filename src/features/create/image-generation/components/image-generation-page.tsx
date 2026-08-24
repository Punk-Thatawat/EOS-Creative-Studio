"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useImageGenerationState } from "../hooks/use-image-generation-state";
import { cx } from "../styles";
import { ImageGenerationTabs } from "./image-generation-tabs";
import { PowerUpTools } from "./power-up-tools";
import { PreviewPanel } from "./preview-panel";
import { PromptPanel } from "./prompt-panel";
import { SettingsPanel } from "./settings-panel";
import { getKnownImageUploadConstraints } from "@/lib/media/upload-validation";

const imageTabByRoute = {
  "text-to-image": "Text to Image",
  "image-to-image": "Image to Image",
  "style-transfer": "AI Style Transfer",
  "background-removal": "AI Background",
  upscale: "Upscale",
  "extend-image": "Extend Image",
} as const;

export function ImageGenerationPage() {
  const state = useImageGenerationState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedImageTab = requestedTab ? imageTabByRoute[requestedTab as keyof typeof imageTabByRoute] : undefined;
  const appliedRouteTabRef = useRef<string | null>(null);
  const setActiveTabRef = useRef(state.setActiveTab);

  useEffect(() => {
    setActiveTabRef.current = state.setActiveTab;
  }, [state.setActiveTab]);

  useEffect(() => {
    if (!requestedTab) {
      appliedRouteTabRef.current = null;
      return;
    }
    if (!requestedImageTab || appliedRouteTabRef.current === requestedTab) return;
    appliedRouteTabRef.current = requestedTab;
    setActiveTabRef.current(requestedImageTab);
  }, [requestedTab, requestedImageTab]);

  const isTextToImageTab = state.activeTab === "Text to Image";
  const isImageToImageTab = state.activeTab === "Image to Image";
  const isStyleTransferTab = state.activeTab === "AI Style Transfer";
  const isBackgroundTab = state.activeTab === "AI Background";
  const isUpscaleTab = state.activeTab === "Upscale";
  const isExtendTab = state.activeTab === "Extend Image";
  const stylePresetFeature = isBackgroundTab ? "background-removal" : isImageToImageTab ? "image-to-image" : "text-to-image";
  const activeStylePresetOptions = state.stylePresetOptions.filter((preset) => preset.features.includes(stylePresetFeature));
  const styleTransferPresetOptions = state.stylePresetOptions.filter((preset) => preset.features.includes("style-transfer"));
  const activeTabIsGenerating = isTextToImageTab ? state.isGenerating : isImageToImageTab ? state.imageToImageIsGenerating : isStyleTransferTab ? state.styleTransferIsGenerating : isBackgroundTab ? state.backgroundIsGenerating : isUpscaleTab ? state.upscaleIsGenerating : isExtendTab ? state.extendIsGenerating : false;
  const hasStyleInstruction = (state.styleSourceMode === "preset" && Boolean(state.styleTransferPreset)) || (state.styleSourceMode === "reference" && Boolean(state.styleReferenceImage)) || Boolean(state.styleTransferPrompt.trim());
  const hasBackgroundInstruction = state.backgroundMode === "remove" || state.backgroundMode === "solid" || (state.backgroundSupportsPrompt && Boolean(state.backgroundPrompt.trim())) || Boolean(state.backgroundReferenceImage);
  const selectedModel = isImageToImageTab ? state.selectedImageToImageModel : isStyleTransferTab ? state.selectedStyleTransferModel : isBackgroundTab ? state.selectedBackgroundModel : isUpscaleTab ? state.selectedUpscaleModel : isExtendTab ? state.selectedExtendModel : state.selectedModel;
  const selectedModelOption = state.activeModelOptions.find((model) => model.model === selectedModel);
  const configuredUploadConstraints = selectedModelOption?.capabilities.uploadConstraints;
  const imageUploadConstraints = configuredUploadConstraints
    ? { maxFileSizeBytes: configuredUploadConstraints.maxFileSizeBytes, maxWidth: configuredUploadConstraints.maxWidth, maxHeight: configuredUploadConstraints.maxHeight }
    : getKnownImageUploadConstraints(selectedModel);
  const hasDefaultModel = state.activeModelOptions.some((model) => model.isDefault);
  const hasSelectedModel = state.activeModelOptions.some((model) => model.model === selectedModel);
    const modelSelectionReady = hasDefaultModel || hasSelectedModel;
  const canGenerate = modelSelectionReady && (isUpscaleTab
    ? Boolean(state.sourceImage) && !activeTabIsGenerating
    : isExtendTab
    ? Boolean(state.sourceImage) && state.extendSupportsInput && !activeTabIsGenerating
    : isBackgroundTab
    ? Boolean(state.sourceImage) && state.backgroundSupportsInput && hasBackgroundInstruction && !activeTabIsGenerating
    : isStyleTransferTab
    ? Boolean(state.sourceImage) && state.styleTransferSupportsInput && hasStyleInstruction && !activeTabIsGenerating
    : (isImageToImageTab ? state.imageToImagePrompt.trim().length > 0 : state.prompt.trim().length > 0) && (!isImageToImageTab || (Boolean(state.sourceImage) && state.imageToImageSupportsInput)) && !activeTabIsGenerating);
  const activeGenerationStatus = isTextToImageTab ? state.generationStatus : isImageToImageTab ? state.imageToImageStatus : isStyleTransferTab ? state.styleTransferStatus : isBackgroundTab ? state.backgroundStatus : isUpscaleTab ? state.upscaleStatus : isExtendTab ? state.extendStatus : "idle";
  const activeGenerationCompletedCount = isTextToImageTab ? state.generationCompletedCount : isImageToImageTab ? state.imageToImageCompletedCount : isStyleTransferTab ? state.styleTransferCompletedCount : isBackgroundTab ? state.backgroundCompletedCount : isUpscaleTab ? state.upscaleCompletedCount : isExtendTab ? state.extendCompletedCount : 0;
  const activeGenerationTotalCount = isTextToImageTab ? state.generationTotalCount : isImageToImageTab ? state.imageToImageTotalCount : isStyleTransferTab ? state.styleTransferTotalCount : isBackgroundTab ? state.backgroundTotalCount : isUpscaleTab ? state.upscaleTotalCount : isExtendTab ? state.extendTotalCount : 0;
  const activeGenerationError = isTextToImageTab ? state.generationError : isImageToImageTab ? state.imageToImageError : isStyleTransferTab ? state.styleTransferError : isBackgroundTab ? state.backgroundError : isUpscaleTab ? state.upscaleError : isExtendTab ? state.extendError : null;
  const activeGenerated = isTextToImageTab ? state.generated : isImageToImageTab ? state.imageToImageGenerated : isStyleTransferTab ? state.styleTransferGenerated : isBackgroundTab ? state.backgroundGenerated : isUpscaleTab ? state.upscaleGenerated : isExtendTab ? state.extendGenerated : false;
  const activeGeneratedUrls = isTextToImageTab ? state.generatedImageUrls : isImageToImageTab ? state.imageToImageUrls : isStyleTransferTab ? state.styleTransferUrls : isBackgroundTab ? state.backgroundUrls : isUpscaleTab ? state.upscaleUrls : isExtendTab ? state.extendUrls : [];
    const optionsFollowModel = Boolean(selectedModel);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<"current" | "gallery">("current");
  const generateTextToImage = () => {
    setPreviewDisplayMode("current");
    void state.generateImage();
  };
  const generateImageToImage = () => {
    setPreviewDisplayMode("current");
    void state.transformImage();
  };
  const generateStyleTransfer = () => {
    setPreviewDisplayMode("current");
    void state.generateStyleTransfer();
  };
  const generateBackground = () => {
    setPreviewDisplayMode("current");
    void state.generateBackground();
  };
  const generateUpscale = () => {
    setPreviewDisplayMode("current");
    void state.generateUpscale();
  };
  const generateExtend = () => {
    setPreviewDisplayMode("current");
    void state.extendImage();
  };
  const generateCurrentTab = isTextToImageTab ? generateTextToImage : isImageToImageTab ? generateImageToImage : isStyleTransferTab ? generateStyleTransfer : isBackgroundTab ? generateBackground : isUpscaleTab ? generateUpscale : generateExtend;

  return <div className={cx("gen-image-page")} data-page="gen-image">
    <section className={cx("gen-image-hero")}><picture className={cx("gen-hero-picture")}><source media="(max-width: 700px)" srcSet="/generated-assets/gen-image-hero-mobile.png" /><Image src="/generated-assets/gen-image-hero.png" alt="Gen Image creative studio hero artwork" width={1976} height={391} priority className={cx("gen-hero-artwork")} /></picture></section>
    <ImageGenerationTabs activeTab={state.activeTab} onTabChange={(nextTab) => { setPreviewDisplayMode("current"); state.setActiveTab(nextTab); if (requestedTab) router.replace("/create/image", { scroll: false }); }} />
    <div className={cx("gen-workspace")}>
      <PromptPanel
        activeTab={state.activeTab}
        prompt={isStyleTransferTab ? state.styleTransferPrompt : isImageToImageTab ? state.imageToImagePrompt : state.prompt}
        negativePrompt={state.negativePrompt}
        smartEnhance={state.smartEnhance}
        style={state.style}
        stylePresetOptions={activeStylePresetOptions}
        styleTransferPresetOptions={styleTransferPresetOptions}
        sourceImage={state.sourceImage}
        sourceImages={isImageToImageTab && state.imageToImageMaxSourceImages > 1 ? state.imageToImageSourceImages : undefined}
        maxSourceImages={isImageToImageTab ? state.imageToImageMaxSourceImages : undefined}
        imageUploadConstraints={imageUploadConstraints}
        workspaceId={state.workspaceId}
        styleSourceMode={state.styleSourceMode}
        styleTransferPreset={state.styleTransferPreset}
        styleReferenceImage={state.styleReferenceImage}
        imageStrength={state.imageStrength}
        contentPreservation={state.contentPreservation}
        facePreservation={state.facePreservation}
        seed={state.seed}
        imageToImageSupportsStrength={state.imageToImageSupportsStrength}
        styleTransferSupportsInput={state.styleTransferSupportsInput}
        styleTransferSupportsReference={state.styleTransferSupportsReference}
        styleTransferSupportsStrength={state.styleTransferSupportsStrength}
        styleTransferSupportsContentPreservation={state.styleTransferSupportsContentPreservation}
        backgroundMode={state.backgroundMode}
        backgroundReferenceImage={state.backgroundReferenceImage}
        backgroundPrompt={state.backgroundPrompt}
        backgroundColor={state.backgroundColor}
        preserveSubject={state.preserveSubject}
        edgeCleanup={state.edgeCleanup}
        addShadow={state.addShadow}
        matchLighting={state.matchLighting}
        backgroundSupportsInput={state.backgroundSupportsInput}
        backgroundSupportsPrompt={state.backgroundSupportsPrompt}
        extendPrompt={state.extendPrompt}
        extendDirection={state.extendDirection}
        extendAmount={state.extendAmount}
        onPromptChange={isStyleTransferTab ? state.setStyleTransferPrompt : isImageToImageTab ? state.setImageToImagePrompt : state.setPrompt}
        onNegativePromptChange={state.setNegativePrompt}
        onSmartEnhanceChange={state.setSmartEnhance}
        onStyleChange={state.setStyle}
        onSourceImageChange={(imageUrl) => {
          if (isImageToImageTab) {
            setPreviewDisplayMode("current");
            state.setImageToImageSourceImage(imageUrl);
            state.setImageToImageGenerated(false);
            state.setImageToImageUrls([]);
            state.setImageToImageError(null);
          } else if (isStyleTransferTab) {
            state.setStyleTransferSourceImage(imageUrl);
            state.setStyleTransferGenerated(false);
            state.setStyleTransferUrls([]);
            state.setStyleTransferError(null);
          } else if (isBackgroundTab) {
            state.setBackgroundSourceImage(imageUrl);
          } else if (isUpscaleTab) {
            state.setUpscaleSourceImage(imageUrl);
          } else if (isExtendTab) {
            state.setExtendSourceImage(imageUrl);
          }
        }}
        onSourceImagesChange={isImageToImageTab && state.imageToImageMaxSourceImages > 1 ? (imageUrls) => {
          setPreviewDisplayMode("current");
          state.setImageToImageSourceImages(imageUrls);
          state.setImageToImageGenerated(false);
          state.setImageToImageUrls([]);
          state.setImageToImageError(null);
        } : undefined}
        onSourceImageClear={() => {
          if (isImageToImageTab) {
            state.setImageToImageSourceImage(null);
            state.setImageToImageGenerated(false);
            state.setImageToImageUrls([]);
            state.setImageToImageError(null);
          } else if (isStyleTransferTab) {
            state.setStyleTransferSourceImage(null);
            state.setStyleTransferGenerated(false);
            state.setStyleTransferUrls([]);
            state.setStyleTransferError(null);
          } else if (isBackgroundTab) {
            state.setBackgroundSourceImage(null);
          } else if (isUpscaleTab) {
            state.setUpscaleSourceImage(null);
          } else if (isExtendTab) {
            state.setExtendSourceImage(null);
          }
        }}
        onStyleSourceModeChange={state.setStyleSourceMode}
        onStyleTransferPresetChange={state.setStyleTransferPreset}
        onStyleReferenceImageChange={(imageUrl) => { state.setStyleReferenceImage(imageUrl); state.setStyleSourceMode("reference"); }}
        onStyleReferenceImageClear={() => state.setStyleReferenceImage(null)}
        onImageStrengthChange={state.setImageStrength}
        onContentPreservationChange={state.setContentPreservation}
        onFacePreservationChange={state.setFacePreservation}
        onSeedChange={state.setSeed}
        onBackgroundModeChange={state.setBackgroundMode}
        onBackgroundReferenceImageChange={state.setBackgroundReferenceImage}
        onBackgroundReferenceImageClear={() => state.setBackgroundReferenceImage(null)}
        onBackgroundPromptChange={state.setBackgroundPrompt}
        onBackgroundColorChange={state.setBackgroundColor}
        onPreserveSubjectChange={state.setPreserveSubject}
        onEdgeCleanupChange={state.setEdgeCleanup}
        onAddShadowChange={state.setAddShadow}
        onMatchLightingChange={state.setMatchLighting}
        onExtendPromptChange={state.setExtendPrompt}
        onExtendDirectionChange={state.setExtendDirection}
        onExtendAmountChange={state.setExtendAmount}
      />
      <PreviewPanel
        key={state.activeTab}
        activeTab={state.activeTab}
        generated={activeGenerated}
        generatedImageUrls={activeGeneratedUrls}
        generationCompletedCount={activeGenerationCompletedCount}
        generationStatus={activeGenerationStatus}
        generationTotalCount={activeGenerationTotalCount}
        isGenerating={activeTabIsGenerating}
        isLoadingRecent={state.isLoadingRecent}
        recentError={state.recentError}
        recentGenerationUrls={state.recentGenerationUrls}
        imageMimeTypes={state.imageMimeTypes}
        selectedRecentImageUrl={state.selectedRecentImageUrl}
        selectedVariation={state.selectedVariation}
        previewDisplayMode={previewDisplayMode}
        onPreviewDisplayModeChange={(mode) => { if (mode === "current") state.clearRecentSelection(); setPreviewDisplayMode(mode); }}
        sourceImage={state.sourceImage}
        backgroundMask={state.backgroundMask}
        backgroundMode={state.backgroundMode}
        backgroundColor={state.backgroundColor}
        backgroundTransparent={isBackgroundTab && state.backgroundMode === "remove"}
        maskTool={state.maskTool}
        brushSize={state.brushSize}
        extendDirection={state.extendDirection}
        extendAmount={state.extendAmount}
        onBackgroundMaskChange={state.setBackgroundMask}
        onMaskToolChange={state.setMaskTool}
        onBrushSizeChange={state.setBrushSize}
        onRecentSelect={state.selectRecentGeneration}
        onVariationSelect={state.selectVariation}
        onRefreshRecent={() => void state.refreshRecentGenerations()}
      />
      <SettingsPanel
        activeTab={state.activeTab}
        canGenerate={canGenerate}
        count={state.count}
        countOptions={state.availableCountOptions}
        backgroundMode={state.backgroundMode}
        generationCompletedCount={activeGenerationCompletedCount}
        generationError={activeGenerationError}
        generationStatus={activeGenerationStatus}
        generationTotalCount={activeGenerationTotalCount}
        imageSizeOpen={state.imageSizeOpen}
        isGenerating={activeTabIsGenerating}
        modelOptions={state.activeModelOptions}
        isLoadingModels={state.isLoadingModels}
        modelCapabilities={state.modelCapabilities}
        modelParams={state.modelParams}
        ratioOptions={state.availableRatioOptions}
        qualityOptions={state.availableQualityOptions}
        qualityEnabled={state.qualityEnabled}
        imageCreditEstimate={state.imageCreditEstimate}
        imageCreditEstimateLoading={state.imageCreditEstimateLoading}
        imageCreditEstimateError={state.imageCreditEstimateError}
        outputFormatOptions={state.availableOutputFormats}
        outputFormat={state.outputFormat}
        optionsFollowModel={optionsFollowModel}
        selectedModel={selectedModel}
        resolution={state.resolution}
        resolutionOptions={state.availableResolutionOptions}
        quality={state.quality}
        ratio={state.ratio}
        onCountChange={state.setCount}
        onGenerate={generateCurrentTab}
        onImageSizeToggle={state.toggleImageSize}
        onModelChange={(model) => { state.setOutputFormat(null); if (isImageToImageTab) state.setSelectedImageToImageModel(model); else if (isStyleTransferTab) state.setSelectedStyleTransferModel(model); else if (isBackgroundTab) state.setSelectedBackgroundModel(model); else if (isUpscaleTab) state.setSelectedUpscaleModel(model); else if (isExtendTab) state.setSelectedExtendModel(model); else state.setSelectedModel(model); }}
        onQualityChange={state.setQuality}
        onOutputFormatChange={state.setOutputFormat}
        onResolutionChange={state.setResolution}
        onRatioChange={state.selectRatio}
        onCancel={isTextToImageTab ? state.cancelTextToImage : isImageToImageTab ? state.cancelImageToImage : isStyleTransferTab ? state.cancelStyleTransfer : isBackgroundTab ? state.cancelBackground : isUpscaleTab ? state.cancelUpscale : state.cancelExtend}
        onModelParamChange={state.setModelParam}
      />
    </div>
    <PowerUpTools />
  </div>;
}
