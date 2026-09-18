"use client";

import Image from "next/image";
import "./assets-universe.css";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { VideoFrameThumbnail } from "@/components/media/video-frame-thumbnail";
import { SearchInput } from "@/components/ui/search-input";
import {
  AlertCircle,
  Archive,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Grid2X2,
  Image as ImageIcon,
  List,
  MoreVertical,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  deleteAsset,
  deleteAssetTag,
  downloadAsset,
  fetchAssets,
  createAssetTag,
  restoreAsset,
  updateAsset,
  type AssetsApiAsset,
  type AssetsApiFilter,
  type AssetsApiListData,
  type AssetsApiTab,
  type AssetsApiType,
} from "@/lib/api/assets";

type FilterType = "All Types" | "Images" | "Videos" | "Documents" | "Audio" | "Other";
type AssetTab = "My Assets" | "Shared with me" | "Team Assets" | "Trash";
type AssetSort = "Newest" | "Oldest";

type Asset = {
  id: string;
  title: string;
  date: string;
  size: string;
  type: string;
  image: string;
  filter: Exclude<FilterType, "All Types">;
  mediaKind: AssetsApiType;
  url: string | null;
  downloadUrl: string | null;
  duration?: string;
  playable?: boolean;
  folder: string | null;
  tags: string[];
};


const apiTabByLabel: Record<AssetTab, AssetsApiTab> = {
  "My Assets": "mine",
  "Shared with me": "shared",
  "Team Assets": "team",
  Trash: "trash",
};

const apiTypeByFilter: Record<FilterType, AssetsApiType | undefined> = {
  "All Types": undefined,
  Images: "image",
  Videos: "video",
  Documents: "document",
  Audio: "audio",
  Other: "other",
};

const filterByApiType: Record<AssetsApiType, Exclude<FilterType, "All Types">> = {
  image: "Images",
  video: "Videos",
  document: "Documents",
  audio: "Audio",
  other: "Other",
};

/* Nothing in the app generates documents yet, so the tab is held out of the
   strip rather than deleted -- flip this to true on the day they ship. */
const showDocumentsTab = false;

type MediaTab = { value: FilterType; label: string; Icon: LucideIcon | null };

const mediaTabs: MediaTab[] = [
  { value: "All Types", label: "ทั้งหมด", Icon: null },
  { value: "Images", label: "ภาพ", Icon: ImageIcon },
  { value: "Videos", label: "วิดีโอ", Icon: Video },
  { value: "Audio", label: "เสียง", Icon: AudioLines },
  { value: "Documents", label: "เอกสาร", Icon: FileText },
];

const visibleMediaTabs = mediaTabs.filter((tab) => showDocumentsTab || tab.value !== "Documents");

const SIDEBAR_GROUP_LIMIT = 5;
const ASSETS_CACHE_TTL_MS = 15_000;

const previewFallbacks: Record<AssetsApiType, string> = {
  image: "/generated-assets/creative-studio-hero-with-text.png",
  video: "/generated-icons-v2/jobs/product-launch.png",
  document: "/generated-icons-v2/templates/social-media.png",
  audio: "/generated-assets/audio-ui/audio-waveform.png",
  other: "/generated-icons-v2/jobs/image-generate.png",
};

const typeColors: Record<string, string> = {
  JPG: "#0bca84", JPEG: "#0bca84", PNG: "#0bca84", WEBP: "#0bca84",
  MP4: "#ef0093", WEBM: "#ef0093", MOV: "#ef0093",
  PDF: "#f20b26", AI: "#6f17d9", PPT: "#ff5e0b", PPTX: "#ff5e0b",
  MP3: "#7f0ec1", WAV: "#7f0ec1", DOC: "#44a8d8", DOCX: "#44a8d8",
};

const emptyData: AssetsApiListData = {
  assets: [],
  summary: { total: 0, images: 0, videos: 0, documents: 0, others: 0 },
  filters: { folders: [], tags: [] },
  pagination: { page: 1, limit: 12, total: 0, totalPages: 1, hasNext: false, hasPrevious: false },
};

type AssetsCacheEntry = { data: AssetsApiListData; cachedAt: number };

function formatLabel(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBytes(value: number | null | undefined): string {
  if (!value || value < 1024) return value ? `${value} B` : "—";
  const units = ["KB", "MB", "GB"];
  let size = value;
  let unitIndex = -1;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function mapApiAsset(asset: AssetsApiAsset): Asset {
  const extension = asset.fileExtension?.replace(/^\./, "").toUpperCase();
  const type = extension || formatLabel(asset.type).toUpperCase();
  return {
    id: asset.id,
    title: /^(create a high-quality image|preserve the entire original image|upscale the provided image|continue the source image)/i.test(asset.title.trim()) ? (metadataString(asset.metadata, "userPrompt") || "ผลงานสร้างสรรค์") : asset.title,
    date: formatDate(asset.createdAt),
    size: asset.sizeLabel || formatBytes(asset.sizeBytes),
    type,
    image: asset.previewUrl ?? (asset.type === "image" && asset.url ? asset.url : asset.type === "video" && asset.url ? asset.url : previewFallbacks[asset.type]),
    filter: filterByApiType[asset.type],
    mediaKind: asset.type,
    url: asset.url ?? null,
    downloadUrl: asset.downloadUrl ?? null,
    duration: metadataString(asset.metadata, "duration"),
    playable: asset.type === "video" || asset.type === "audio",
    folder: asset.folder ?? null,
    tags: asset.tags ?? [],
  };
}

type TagDialog = {
  assetId: string | null;
};

type SelectOption = { value: string; label: string; count?: number };

function TypeIcon({ kind }: { kind: AssetsApiType }) {
  if (kind === "video") return <Video size={15} strokeWidth={2.5} />;
  if (kind === "audio") return <AudioLines size={15} strokeWidth={2.5} />;
  if (kind === "document") return <FileText size={15} strokeWidth={2.5} />;
  return <ImageIcon size={15} strokeWidth={2.5} />;
}

function AudioAssetPreview() {
  return <div className="asset-audio-preview" aria-hidden="true">
    <span className="asset-audio-preview-glow" />
    <Image src="/generated-assets/audio-ui/audio-waveform.png" alt="" fill sizes="(max-width: 767px) 90vw, 30vw" unoptimized className="asset-audio-waveform" />
    <span className="asset-audio-preview-label"><AudioLines size={13} /> AUDIO</span>
  </div>;
}

function FilterSelect({
  label,
  options,
  value,
  onSelect,
  open,
  onToggle,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) onToggle(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggle(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onToggle, open]);

  return <div className={`assets-select ${open ? "is-open" : ""}`} ref={selectRef}>
    <button type="button" className="assets-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => onToggle(!open)}>
      <span>{label}</span>
      <ChevronDown className="assets-select-chevron" size={15} aria-hidden="true" />
    </button>
    {open ? <div className="assets-select-menu" role="listbox" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return <button type="button" role="option" aria-selected={selected} className={`assets-select-option ${selected ? "is-selected" : ""}`} value={option.value} key={option.value || "all"} onClick={() => { onSelect(option.value); onToggle(false); }}>
          <span>{option.label}</span>
          {selected ? <Check size={15} aria-hidden="true" /> : null}
        </button>;
      })}
    </div> : null}
  </div>;
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.mediaKind === "audio") return <AudioAssetPreview />;
  if (asset.mediaKind === "video" && asset.url && asset.image === asset.url) {
    return <VideoFrameThumbnail key={asset.url} src={asset.url} alt={`ภาพตัวอย่าง ${asset.title}`} className="asset-preview-video" fallback={<span className="flex h-full w-full items-center justify-center text-white/70"><Video size={32} /></span>} />;
  }
  return <Image src={asset.image} alt="" fill sizes="(max-width: 1100px) 50vw, 22vw" loading="lazy" unoptimized />;
}

function AssetPreviewPopup({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const source = asset.url ?? asset.image;
  if (asset.mediaKind === "video" && asset.url) {
    return <div className="video-modal assets-video-modal" role="dialog" aria-modal="true" aria-label={`ตัวอย่าง ${asset.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="video-modal-shell assets-video-modal-shell" onMouseDown={(event) => event.stopPropagation()}>
        <div className="video-modal-actions"><button type="button" className="video-modal-close" onClick={onClose} aria-label="ปิดตัวอย่าง"><X size={22} /></button></div>
        <EosVideoPlayer src={asset.url} autoPlay ariaLabel={asset.title} />
      </div>
    </div>;
  }
  return <div className="assets-preview-popup" role="dialog" aria-modal="true" aria-label={`ตัวอย่าง ${asset.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="assets-preview-popup-content">
      <button type="button" className="assets-preview-popup-close" onClick={onClose} aria-label="ปิดตัวอย่าง"><X size={20} /></button>
      {asset.mediaKind === "audio" && asset.url ? <div className="assets-preview-popup-audio"><AudioLines size={34} /><strong>{asset.title}</strong><audio src={asset.url} controls autoPlay aria-label={asset.title} /></div> : null}
      {asset.mediaKind === "document" && asset.url ? <iframe className="assets-preview-popup-frame" src={asset.url} title={asset.title} /> : null}
      {asset.mediaKind !== "video" && asset.mediaKind !== "audio" && !(asset.mediaKind === "document" && asset.url) ? <div className="assets-preview-popup-image-wrap"><Image className="assets-preview-popup-image" src={source} alt={asset.title} fill sizes="94vw" unoptimized /></div> : null}
    </div>
  </div>;
}

type TagListProps = {
  items: AssetsApiFilter[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (item: AssetsApiFilter) => void;
  removeBusy: boolean;
};

function TagList({ items, activeId, onSelect, onRemove, removeBusy }: TagListProps) {
  return (
    <>
      {items.map((item) => {
        const isActive = activeId === item.id;
        const label = formatLabel(item.name);

        return (
          <span className="assets-tag-chip" key={item.id}>
            <button
              type="button"
              className={`assets-tag-chip-main ${isActive ? "is-active" : ""}`}
              onClick={() => onSelect(isActive ? null : item.id)}
            >
              <span>{label}</span>
              <b>{formatCount(item.count)}</b>
            </button>

            {/* Deleting a tag used to be one bin in the panel header, acting on
                whatever happened to be selected. It rides its own chip now, so
                only the selected tag offers one and the target is never in doubt. */}
            {isActive ? (
              <button
                type="button"
                className="assets-tag-remove"
                aria-label={`ลบแท็ก ${label}`}
                title={`ลบแท็ก ${label}`}
                disabled={removeBusy}
                onClick={() => onRemove(item)}
              >
                <X size={12} strokeWidth={3} />
              </button>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

type TagDeleteConfirmProps = {
  tag: AssetsApiFilter;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function TagDeleteConfirm({ tag, busy, onCancel, onConfirm }: TagDeleteConfirmProps) {
  const label = formatLabel(tag.name);

  return (
    <div className="assets-tag-delete-popover" role="dialog" aria-label={`ยืนยันการลบ ${label}`}>
      <div className="assets-tag-delete-copy">
        <span className="assets-tag-delete-icon"><Trash2 size={16} /></span>
        <div>
          <strong>ลบแท็ก?</strong>
          <p>“{label}” จะถูกลบออกจากแอสเซ็ตของคุณ</p>
        </div>
      </div>
      <div className="assets-tag-delete-actions">
        <button type="button" onClick={onCancel} disabled={busy}>ยกเลิก</button>
        <button type="button" onClick={onConfirm} disabled={busy}>ลบ</button>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  const queryParams = useSearchParams();
  const searchRef = useRef(queryParams.get("q") ?? "");
  const [activeTab] = useState<AssetTab>("My Assets");
  const [activeType, setActiveType] = useState<FilterType>("All Types");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<AssetSort>("Newest");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [search, setSearch] = useState(() => queryParams.get("q") ?? "");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [openMenuAsset, setOpenMenuAsset] = useState<string | null>(null);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [busyTagName, setBusyTagName] = useState<string | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<AssetsApiFilter | null>(null);
  const [groupDialog, setGroupDialog] = useState<TagDialog | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsData, setAssetsData] = useState<AssetsApiListData>(emptyData);
  const assetsCacheRef = useRef(new Map<string, AssetsCacheEntry>());
  const hasLoadedAssetsRef = useRef(false);

  // Keeps ?q= and the search box in step when the user goes back or forward.
  // The "assets-search" listener that used to sit here was for the header's
  // search box, which no longer exists -- nothing dispatches that event now.
  useEffect(() => {
    const syncSearchFromUrl = () => {
      const nextSearch = new URLSearchParams(window.location.search).get("q") ?? "";
      if (searchRef.current === nextSearch) return;
      searchRef.current = nextSearch;
      setSearch(nextSearch);
      setPage(1);
    };
    window.addEventListener("popstate", syncSearchFromUrl);
    return () => window.removeEventListener("popstate", syncSearchFromUrl);
  }, []);

  useEffect(() => {
    const cacheKey = JSON.stringify({
      tab: apiTabByLabel[activeTab],
      type: apiTypeByFilter[activeType] ?? null,
      search: search.trim(),
      tag: activeTag,
      sort: activeSort,
      page,
      refreshKey,
    });
    const cached = assetsCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < ASSETS_CACHE_TTL_MS) {
      hasLoadedAssetsRef.current = true;
      setAssetsData(cached.data);
      setLoading(false);
      setIsRefreshing(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    const hadPreviousData = hasLoadedAssetsRef.current;
    let cancelled = false;
    const load = async () => {
      setLoading(!hadPreviousData);
      setIsRefreshing(hadPreviousData);
      setError(null);
      try {
        const nextData = await fetchAssets({
          tab: apiTabByLabel[activeTab],
          type: apiTypeByFilter[activeType],
          search: search.trim(),
          tag: activeTag ?? undefined,
          sort: activeSort.toLowerCase() as "newest" | "oldest",
          page,
          limit: 12,
          signal: controller.signal,
        });
        if (!cancelled) {
          assetsCacheRef.current.set(cacheKey, { data: nextData, cachedAt: Date.now() });
          hasLoadedAssetsRef.current = true;
          setAssetsData(nextData);
        }
      } catch (requestError) {
        if (!cancelled && !controller.signal.aborted) {
          if (!hadPreviousData) setAssetsData(emptyData);
          setError(hadPreviousData ? null : requestError instanceof Error ? requestError.message : "Unable to load assets");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    const timeoutId = window.setTimeout(() => { void load(); }, search.trim() ? 220 : 0);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeSort, activeTab, activeTag, activeType, page, refreshKey, search]);

  useEffect(() => {
    const refreshGeneratedAssets = () => {
      if (activeTab !== "My Assets") return;
      setRefreshKey((current) => current + 1);
    };
    window.addEventListener("eos:generation-completed", refreshGeneratedAssets);
    return () => window.removeEventListener("eos:generation-completed", refreshGeneratedAssets);
  }, [activeTab]);

  const assets = useMemo(
    () => assetsData.assets.filter((asset) => asset.source === "generated").map(mapApiAsset),
    [assetsData.assets],
  );
  const visibleTagItems = showAllTags ? assetsData.filters.tags : assetsData.filters.tags.slice(0, SIDEBAR_GROUP_LIMIT);
  const totalPages = Math.max(1, assetsData.pagination.totalPages || 1);
  const groupAsset = groupDialog?.assetId ? assets.find((asset) => asset.id === groupDialog.assetId) : null;
  const groupAssetTags = new Set((groupAsset?.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()));
  const groupOptions = groupDialog?.assetId
    ? assetsData.filters.tags.filter((item) => !groupAssetTags.has(item.name.trim().toLocaleLowerCase()))
    : [];
  const duplicateTag = Boolean(groupDialog?.assetId) && groupAssetTags.has(groupName.trim().toLocaleLowerCase());
  const startItem = assetsData.pagination.total === 0 ? 0 : ((assetsData.pagination.page - 1) * assetsData.pagination.limit) + 1;
  const endItem = Math.min(assetsData.pagination.total, startItem + assetsData.pagination.limit - 1);
  const rangeLabel = assetsData.pagination.total === 0
    ? "ไม่มีรายการ"
    : `แสดง ${startItem}–${endItem} จาก ${formatCount(assetsData.pagination.total)} รายการ`;

  const openTagDialog = (assetId: string | null = null) => {
    setOpenFilter(null);
    setPendingDeleteTag(null);
    setOpenMenuAsset(null);
    setGroupName("");
    setGroupDialog({ assetId });
  };

  const closeGroupDialog = () => {
    if (groupSaving) return;
    setGroupDialog(null);
    setGroupName("");
  };

  const refreshAfterGroupMutation = async () => {
    assetsCacheRef.current.clear();
    const nextMineData = await fetchAssets({
      tab: "mine",
      type: apiTypeByFilter[activeType],
      search,
      tag: activeTag ?? undefined,
      sort: activeSort.toLowerCase() as "newest" | "oldest",
      page,
      limit: 12,
    });
    if (activeTab === "My Assets") setAssetsData(nextMineData);
    else setRefreshKey((current) => current + 1);
  };

  const handleSaveGroup = async () => {
    if (!groupDialog || !groupName.trim()) return;
    if (duplicateTag) return;
    const name = groupName.trim();
    setGroupSaving(true);
    setError(null);
    try {
      const existingGroup = assetsData.filters.tags.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      const savedName = existingGroup?.name ?? (await createAssetTag(name)).name;
      if (groupDialog.assetId) {
        const sourceAsset = assetsData.assets.find((asset) => asset.id === groupDialog.assetId);
        const tags = Array.from(new Map([...(sourceAsset?.tags ?? []), savedName].map((tag) => [tag.toLocaleLowerCase(), tag])).values());
        await updateAsset(groupDialog.assetId, { tags });
      }
      setGroupDialog(null);
      setGroupName("");
      await refreshAfterGroupMutation();
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "Unable to save tag");
    } finally {
      setGroupSaving(false);
    }
  };


  const handleDeleteTag = async (tag: AssetsApiFilter) => {
    if (!tag.name.trim() || busyTagName) return;
    setBusyTagName(tag.name);
    setPendingDeleteTag(null);
    setError(null);
    assetsCacheRef.current.clear();
    try {
      await deleteAssetTag(tag.name);
      if (activeTag === tag.id) {
        setAssetsData((current) => ({
          ...current,
          filters: { ...current.filters, tags: current.filters.tags.filter((item) => item.id !== tag.id) },
        }));
        window.requestAnimationFrame(() => {
          setActiveTag(null);
          setPage(1);
        });
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : "Unable to delete tag");
    } finally {
      setBusyTagName(null);
    }
  };

  const handleAssetAction = async (assetId: string, action: "trash" | "restore") => {
    setBusyAssetId(assetId);
    setError(null);
    try {
      if (action === "trash") await deleteAsset(assetId);
      else await restoreAsset(assetId);
      setOpenMenuAsset(null);
      setSelectedAsset(null);
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update asset");
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleDownload = async (asset: Asset) => {
    if (busyAssetId) return;
    setBusyAssetId(asset.id);
    setError(null);
    try {
      const downloaded = await downloadAsset(asset.id);
      const objectUrl = URL.createObjectURL(downloaded.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloaded.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setOpenMenuAsset(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download asset");
    } finally {
      setBusyAssetId(null);
    }
  };

  const openAssetPreview = (asset: Asset) => {
    setSelectedAsset(asset.id);
    setOpenMenuAsset(null);
    setPreviewAsset(asset);
  };

  const paginationButtons = totalPages <= 4 ? Array.from({ length: totalPages }, (_, index) => index + 1) : [1, 2, 3, totalPages];

  return (
    <div className="assets-page" data-active-tab={activeTab} data-no-translate>
      <section className="studio-hero-frame assets-universe-hero" aria-label="แอสเซ็ตของ EOS Creative Studio">
        <picture>
          <source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/assets-mobile.webp" />
          <Image
            src="/generated-assets/studio-heroes-v4/assets-desktop.webp"
            alt="ภาพรวมเครื่องมือสร้างภาพ วิดีโอ เสียง และเอกสารของ EOS Creative Studio"
            width={2400}
            height={435}
            priority
            className="assets-universe-full-art"
            sizes="100vw"
          />
        </picture>
      </section>
      <div className="assets-retention-notice" role="note"><Clock3 size={16} aria-hidden="true" /><span>ผลงานที่สร้างจะถูกเก็บไว้ 7 วัน กรุณาดาวน์โหลดไฟล์ที่ต้องการเก็บไว้ก่อนหมดอายุ</span></div>

      <section className="assets-library" aria-label="คลังแอสเซ็ต">
        <div className="assets-toolbar">
          <div className="assets-media-tabs" role="group" aria-label="ประเภทไฟล์">
            {visibleMediaTabs.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeType === value}
                className={activeType === value ? "is-active" : ""}
                onClick={() => { setActiveType(value); setPage(1); }}
              >
                {Icon ? <Icon size={16} /> : null}
                {label}
              </button>
            ))}
          </div>

          {/* Tags share the row with the media types. They used to sit in a card
              below, paired with folders; folders are gone from this page, so this
              is the only grouping left and it belongs beside the other filters. */}
          <div className="assets-tag-strip" aria-label="แท็ก">
            <span className="assets-tag-strip-divider" aria-hidden="true" />

            <TagList
              items={visibleTagItems}
              activeId={activeTag}
              onSelect={(id) => { setActiveTag(id); setPage(1); }}
              onRemove={setPendingDeleteTag}
              removeBusy={busyTagName !== null}
            />

            {assetsData.filters.tags.length > SIDEBAR_GROUP_LIMIT ? (
              <button
                type="button"
                className={`assets-show-more ${showAllTags ? "is-expanded" : ""}`}
                aria-expanded={showAllTags}
                onClick={() => setShowAllTags((current) => !current)}
              >
                {showAllTags ? "ย่อลง" : "ดูทั้งหมด"} <ChevronDown size={14} />
              </button>
            ) : null}

            <button type="button" className="assets-add-tag" onClick={() => openTagDialog()}>
              <Plus size={16} /> แท็ก
            </button>

            {pendingDeleteTag ? (
              <TagDeleteConfirm
                tag={pendingDeleteTag}
                busy={busyTagName !== null}
                onCancel={() => setPendingDeleteTag(null)}
                onConfirm={() => void handleDeleteTag(pendingDeleteTag)}
              />
            ) : null}
          </div>
          <div className="assets-filters">
            <FilterSelect
              key="sort"
              label={activeSort === "Newest" ? "ล่าสุด" : "เก่าสุด"}
              value={activeSort}
              options={[{ value: "Newest", label: "ล่าสุด" }, { value: "Oldest", label: "เก่าสุด" }]}
              onSelect={(value) => { setActiveSort(value as AssetSort); setPage(1); }}
              open={openFilter === "sort"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "sort" : null)}
            />
            <div className="assets-view-toggle" aria-label="เปลี่ยนมุมมองแอสเซ็ต">
              <button type="button" aria-label="มุมมองตาราง" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")}><Grid2X2 size={18} /></button>
              <button type="button" aria-label="มุมมองรายการ" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><List size={18} /></button>
            </div>
          </div>
        </div>

        <div className="assets-search-row">
          <SearchInput className="w-full sm:w-[230px]" aria-label="ค้นหาแอสเซ็ต" value={search} onValueChange={setSearch} placeholder="ค้นหาแอสเซ็ต..." />
          <span>{rangeLabel}</span>
        </div>

        <div className="assets-content-grid">

          <div className={`${view === "grid" ? "assets-grid" : "assets-list"} ${isRefreshing ? "is-refreshing" : ""}`} aria-busy={loading || isRefreshing}>
            {loading ? Array.from({ length: 8 }, (_, index) => <div className="asset-card assets-loading-card" key={`loading-${index}`} aria-hidden="true" />) : null}
            {!loading && error ? <div className="assets-error" role="alert"><AlertCircle size={24} /><strong>โหลดผลงานไม่สำเร็จ</strong><span>{error}</span><button type="button" onClick={() => setRefreshKey((current) => current + 1)}>ลองอีกครั้ง</button></div> : null}
            {!loading && !error ? assets.map((asset) => <article key={asset.id} className={`asset-card ${selectedAsset === asset.id ? "is-selected" : ""} ${openMenuAsset === asset.id ? "is-menu-open" : ""}`} tabIndex={0} aria-label={`ดูผลงาน ${asset.title}`} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openAssetPreview(asset); } }} onClick={() => openAssetPreview(asset)}>
              <div className="asset-card-media">
                <AssetPreview asset={asset} />
                <span className="asset-type-badge" style={{ backgroundColor: typeColors[asset.type] ?? "#73768a" }}><TypeIcon kind={asset.mediaKind} />{asset.type}</span>
                {asset.playable ? <button type="button" className="asset-play" aria-label={`เล่น ${asset.title}`} onClick={(event) => { event.stopPropagation(); openAssetPreview(asset); }}><Play size={20} fill="white" /></button> : null}
                {asset.duration ? <span className="asset-duration">{asset.duration}</span> : null}
              </div>
              <div className="asset-card-footer"><div><strong>{asset.title}</strong><span>{asset.date} <i>•</i> {asset.size}</span></div><div className="asset-card-actions"><button type="button" aria-label={`ดาวน์โหลด ${asset.title}`} onClick={(event) => { event.stopPropagation(); void handleDownload(asset); }} disabled={busyAssetId === asset.id}><Download size={17} /></button><button type="button" aria-label={`ตัวเลือกเพิ่มเติมของ ${asset.title}`} onClick={(event) => { event.stopPropagation(); setOpenMenuAsset(openMenuAsset === asset.id ? null : asset.id); }} disabled={busyAssetId === asset.id}><MoreVertical size={18} /></button>{openMenuAsset === asset.id ? <div className="asset-card-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                <button type="button" role="menuitem" onClick={() => void handleDownload(asset)} disabled={busyAssetId === asset.id}><Download size={14} />{busyAssetId === asset.id ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด"}</button>
                {activeTab !== "Trash" ? <button type="button" role="menuitem" onClick={() => openTagDialog(asset.id)}><Plus size={14} />เพิ่มแท็ก</button> : null}
                {activeTab === "Trash" ? <button type="button" role="menuitem" onClick={() => void handleAssetAction(asset.id, "restore")}><RotateCcw size={14} />กู้คืน</button> : <button type="button" role="menuitem" onClick={() => void handleAssetAction(asset.id, "trash")}><Trash2 size={14} />ย้ายไปถังขยะ</button>}
              </div> : null}</div></div>
            </article>) : null}
            {!loading && !error && assets.length === 0 ? <div className="assets-empty"><Archive size={24} /><strong>ไม่พบผลงานที่ตรงกัน</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}
          </div>
        </div>

        <div className="assets-pagination"><span>{rangeLabel}</span><div><button type="button" aria-label="หน้าก่อนหน้า" disabled={!assetsData.pagination.hasPrevious} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={18} /></button>{paginationButtons.map((value, index) => <span key={value} className="assets-pagination-page">{totalPages > 4 && index === paginationButtons.length - 1 ? <span className="assets-pagination-ellipsis" aria-hidden="true">…</span> : null}<button type="button" className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button></span>)}<button type="button" aria-label="หน้าถัดไป" disabled={!assetsData.pagination.hasNext} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={18} /></button></div></div>
      </section>

      {groupDialog ? <div className="assets-group-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeGroupDialog(); }}>
        <div className="assets-group-dialog" role="dialog" aria-modal="true" aria-labelledby="assets-group-dialog-title">
          <div className="assets-group-dialog-heading"><strong id="assets-group-dialog-title">{groupDialog.assetId ? "เพิ่มแท็ก" : "สร้างแท็ก"}</strong><button type="button" onClick={closeGroupDialog} disabled={groupSaving} aria-label="ปิด">×</button></div>
          {groupDialog.assetId ? <div className="assets-group-options">
            {groupOptions.length ? groupOptions.map((item) => <button type="button" key={item.id} className={groupName === item.name ? "is-selected" : ""} onClick={() => setGroupName(item.name)}>{formatLabel(item.name)}<span>{formatCount(item.count)}</span></button>) : <span className="assets-group-options-empty">ไม่มีแท็กที่ใช้ได้กับแอสเซ็ตนี้</span>}
          </div> : null}
          <input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="ชื่อแท็ก" maxLength={120} onKeyDown={(event) => { if (event.key === "Enter") void handleSaveGroup(); }} />
          {duplicateTag ? <span className="assets-group-dialog-error" role="alert">แอสเซ็ตนี้มีแท็กนี้อยู่แล้ว</span> : null}
          <div className="assets-group-dialog-actions"><button type="button" onClick={closeGroupDialog} disabled={groupSaving}>ยกเลิก</button><button type="button" onClick={() => void handleSaveGroup()} disabled={groupSaving || !groupName.trim() || duplicateTag}>{groupSaving ? "กำลังบันทึก..." : groupDialog.assetId ? "บันทึก" : "สร้าง"}</button></div>
        </div>
      </div> : null}
      {previewAsset ? <AssetPreviewPopup asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </div>
  );
}
