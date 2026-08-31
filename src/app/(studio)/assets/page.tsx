"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import {
  AlertCircle,
  Archive,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Grid2X2,
  Image as ImageIcon,
  List,
  LoaderCircle,
  MoreVertical,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import {
  deleteAsset,
  deleteAssetFolder,
  deleteAssetTag,
  downloadAsset,
  emptyTrash,
  fetchAssets,
  createAssetFolder,
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

const tabs: AssetTab[] = ["My Assets"];

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

const filterOptions: FilterType[] = ["All Types", "Images", "Videos", "Documents", "Audio", "Other"];
const defaultAssetFolderNames = new Set(["image", "videos", "voice", "document"]);
const SIDEBAR_GROUP_LIMIT = 5;
const ASSETS_CACHE_TTL_MS = 15_000;

const previewFallbacks: Record<AssetsApiType, string> = {
  image: "/generated-assets/creative-studio-hero-with-text.png",
  video: "/generated-icons-v2/jobs/product-launch.png",
  document: "/generated-icons-v2/templates/social-media.png",
  audio: "/generated-assets/audio-ui/audio-waveform.png",
  other: "/generated-icons-v2/jobs/image-generate.png",
};

const summaryIconPaths = {
  total: "/generated-assets/assets-summary-icons/asset-summary-total.png",
  images: "/generated-assets/assets-summary-icons/asset-summary-images.png",
  videos: "/generated-assets/assets-summary-icons/asset-summary-videos.png",
  documents: "/generated-assets/assets-summary-icons/asset-summary-documents.png",
  other: "/generated-assets/assets-summary-icons/asset-summary-other.png",
} as const;

const typeColors: Record<string, string> = {
  JPG: "#0bca84", JPEG: "#0bca84", PNG: "#0bca84", WEBP: "#0bca84",
  MP4: "#ef0093", WEBM: "#ef0093", MOV: "#ef0093",
  PDF: "#f20b26", AI: "#6f17d9", PPT: "#ff5e0b", PPTX: "#ff5e0b",
  MP3: "#7f0ec1", WAV: "#7f0ec1", DOC: "#44a8d8", DOCX: "#44a8d8",
};

const ctaByTab: Record<AssetTab, { lineOne: string; lineTwoPrefix: string; accent: string; lineTwoSuffix: string; body: string; action: string }> = {
  "My Assets": { lineOne: "Keep your assets organized", lineTwoPrefix: "and your ", accent: "creativity", lineTwoSuffix: " unstoppable.", body: "Upgrade for more storage, faster results, and priority AI power.", action: "UPGRADE PLAN" },
  "Shared with me": { lineOne: "Keep every review moving", lineTwoPrefix: "with your ", accent: "creative team", lineTwoSuffix: ".", body: "Upgrade for more shared storage, faster reviews, and priority AI power.", action: "UPGRADE PLAN" },
  "Team Assets": { lineOne: "Make your team", lineTwoPrefix: "and your ", accent: "creativity", lineTwoSuffix: " unstoppable.", body: "Upgrade for more team storage, faster results, and shared AI power.", action: "UPGRADE PLAN" },
  Trash: { lineOne: "Recover what still matters", lineTwoPrefix: "before your ", accent: "trash expires", lineTwoSuffix: ".", body: "Deleted assets are kept for a limited time before permanent removal.", action: "EMPTY TRASH" },
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
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
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
    title: asset.title,
    date: formatDate(asset.createdAt),
    size: asset.sizeLabel || formatBytes(asset.sizeBytes),
    type,
    image: asset.previewUrl ?? (asset.type === "image" && asset.url ? asset.url : previewFallbacks[asset.type]),
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

type GroupDialog = {
  kind: "folder" | "tag";
  assetId: string | null;
};

type SelectOption = { value: string; label: string; count?: number };

function TypeIcon({ kind }: { kind: AssetsApiType }) {
  if (kind === "video") return <Video size={15} strokeWidth={2.5} />;
  if (kind === "audio") return <AudioLines size={15} strokeWidth={2.5} />;
  if (kind === "document") return <FileText size={15} strokeWidth={2.5} />;
  return <ImageIcon size={15} strokeWidth={2.5} />;
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

function SummaryMetric({ icon, value, label, color }: { icon: ReactNode; value: number; label: string; color: string }) {
  return <div className="assets-summary-metric"><span className="assets-summary-icon" style={{ color }}>{icon}</span><strong>{formatCount(value)}</strong><span>{label}</span></div>;
}

function AssetPreview({ asset }: { asset: Asset }) {
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
    return <div className="video-modal assets-video-modal" role="dialog" aria-modal="true" aria-label={`${asset.title} preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="video-modal-shell assets-video-modal-shell" onMouseDown={(event) => event.stopPropagation()}>
        <div className="video-modal-actions"><button type="button" className="video-modal-close" onClick={onClose} aria-label="Close preview"><X size={22} /></button></div>
        <EosVideoPlayer src={asset.url} autoPlay ariaLabel={asset.title} />
      </div>
    </div>;
  }
  return <div className="assets-preview-popup" role="dialog" aria-modal="true" aria-label={`${asset.title} preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="assets-preview-popup-content">
      <button type="button" className="assets-preview-popup-close" onClick={onClose} aria-label="Close preview"><X size={20} /></button>
      {asset.mediaKind === "audio" && asset.url ? <div className="assets-preview-popup-audio"><AudioLines size={34} /><strong>{asset.title}</strong><audio src={asset.url} controls autoPlay aria-label={asset.title} /></div> : null}
      {asset.mediaKind === "document" && asset.url ? <iframe className="assets-preview-popup-frame" src={asset.url} title={asset.title} /> : null}
      {asset.mediaKind !== "video" && asset.mediaKind !== "audio" && !(asset.mediaKind === "document" && asset.url) ? <div className="assets-preview-popup-image-wrap"><Image className="assets-preview-popup-image" src={source} alt={asset.title} fill sizes="94vw" unoptimized /></div> : null}
    </div>
  </div>;
}

function FilterList({ items, activeId, onSelect, kind }: { items: AssetsApiFilter[]; activeId: string | null; onSelect: (id: string | null) => void; kind: "folder" | "tag" }) {
  return <>{items.map((item) => <button type="button" key={item.id} className={activeId === item.id ? "is-active" : ""} onClick={() => onSelect(activeId === item.id ? null : item.id)}>
      {kind === "folder" ? <Folder size={17} /> : null}<span>{formatLabel(item.name)}</span><b>{formatCount(item.count)}</b>
  </button>)}</>;
}

export default function AssetsPage() {
  const queryParams = useSearchParams();
  const searchRef = useRef(queryParams.get("q") ?? "");
  const [activeTab, setActiveTab] = useState<AssetTab>("My Assets");
  const [activeType, setActiveType] = useState<FilterType>("All Types");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<AssetSort>("Newest");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [search, setSearch] = useState(() => queryParams.get("q") ?? "");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [openMenuAsset, setOpenMenuAsset] = useState<string | null>(null);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [busyFolderName, setBusyFolderName] = useState<string | null>(null);
  const [busyTagName, setBusyTagName] = useState<string | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<AssetsApiFilter | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<AssetsApiFilter | null>(null);
  const [groupDialog, setGroupDialog] = useState<GroupDialog | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsData, setAssetsData] = useState<AssetsApiListData>(emptyData);
  const assetsCacheRef = useRef(new Map<string, AssetsCacheEntry>());
  const hasLoadedAssetsRef = useRef(false);

  useEffect(() => {
    const syncHeaderSearch = () => {
      const nextSearch = new URLSearchParams(window.location.search).get("q") ?? "";
      if (searchRef.current === nextSearch) return;
      searchRef.current = nextSearch;
      setSearch(nextSearch);
      setPage(1);
    };
    window.addEventListener("assets-search", syncHeaderSearch);
    window.addEventListener("popstate", syncHeaderSearch);
    return () => {
      window.removeEventListener("assets-search", syncHeaderSearch);
      window.removeEventListener("popstate", syncHeaderSearch);
    };
  }, []);

  useEffect(() => {
    const cacheKey = JSON.stringify({
      tab: apiTabByLabel[activeTab],
      type: apiTypeByFilter[activeType] ?? null,
      search: search.trim(),
      folder: activeFolder,
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
          folder: activeFolder ?? undefined,
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
  }, [activeFolder, activeSort, activeTab, activeTag, activeType, page, refreshKey, search]);

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
  const folderItems = useMemo(() => {
    const tabFolderName = activeTab === "Trash" ? "All Trash" : activeTab === "Shared with me" ? "All Shared" : activeTab === "Team Assets" ? "All Team Assets" : "All Assets";
    return [{ id: "all", name: tabFolderName, count: assetsData.summary.total }, ...assetsData.filters.folders.filter((item) => item.id !== "all")];
  }, [activeTab, assetsData.filters.folders, assetsData.summary.total]);
  const visibleFolderItems = showAllFolders ? folderItems : folderItems.slice(0, SIDEBAR_GROUP_LIMIT);
  const visibleTagItems = showAllTags ? assetsData.filters.tags : assetsData.filters.tags.slice(0, SIDEBAR_GROUP_LIMIT);
  const totalPages = Math.max(1, assetsData.pagination.totalPages || 1);
  const cta = ctaByTab[activeTab];
  const activeFolderLabel = activeFolder ? formatLabel(folderItems.find((item) => item.id === activeFolder)?.name ?? activeFolder) : "All Folders";
  const activeTagLabel = activeTag ? formatLabel(assetsData.filters.tags.find((item) => item.id === activeTag)?.name ?? activeTag) : "All Tags";
  const groupAsset = groupDialog?.assetId ? assets.find((asset) => asset.id === groupDialog.assetId) : null;
  const groupAssetTags = new Set((groupAsset?.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()));
  const groupOptions = groupDialog?.assetId
    ? (groupDialog.kind === "tag"
      ? assetsData.filters.tags.filter((item) => !groupAssetTags.has(item.name.trim().toLocaleLowerCase()))
      : assetsData.filters.folders.filter((item) => !defaultAssetFolderNames.has(item.name.trim().toLocaleLowerCase())))
    : [];
  const duplicateTag = groupDialog?.kind === "tag" && Boolean(groupDialog.assetId) && groupAssetTags.has(groupName.trim().toLocaleLowerCase());
  const defaultFolderSelected = groupDialog?.kind === "folder" && Boolean(groupDialog.assetId) && defaultAssetFolderNames.has(groupName.trim().toLocaleLowerCase());
  const selectedCustomFolder = activeFolder
    ? assetsData.filters.folders.find((item) => item.id === activeFolder && !defaultAssetFolderNames.has(item.name.trim().toLocaleLowerCase()))
    : undefined;
  const selectedTag = activeTag ? assetsData.filters.tags.find((item) => item.id === activeTag) : undefined;
  const startItem = assetsData.pagination.total === 0 ? 0 : ((assetsData.pagination.page - 1) * assetsData.pagination.limit) + 1;
  const endItem = Math.min(assetsData.pagination.total, startItem + assetsData.pagination.limit - 1);
  const rangeLabel = assetsData.pagination.total === 0
    ? activeTab === "Trash" ? "No deleted assets" : activeTab === "Shared with me" ? "No shared assets" : activeTab === "Team Assets" ? "No team assets" : "No assets yet"
    : `Showing ${startItem}–${endItem} of ${formatCount(assetsData.pagination.total)} ${activeTab === "Trash" ? "deleted assets" : activeTab === "Shared with me" ? "shared assets" : activeTab === "Team Assets" ? "team assets" : "assets"}`;

  const handleTabChange = (tab: AssetTab) => {
    setActiveTab(tab);
    setActiveType("All Types");
    setActiveFolder(null);
    setActiveTag(null);
    setActiveSort("Newest");
    setOpenFilter(null);
    setShowAllFolders(false);
    setShowAllTags(false);
    setSearch("");
    window.dispatchEvent(new Event("assets-search-clear"));
    setPage(1);
    setPendingDeleteFolder(null);
    setPendingDeleteTag(null);
    setSelectedAsset(null);
    setOpenMenuAsset(null);
    window.history.replaceState(null, "", "/assets");
  };

  const openGroupDialog = (kind: GroupDialog["kind"], assetId: string | null = null) => {
    setOpenFilter(null);
    setPendingDeleteFolder(null);
    setPendingDeleteTag(null);
    setOpenMenuAsset(null);
    setGroupName("");
    setGroupDialog({ kind, assetId });
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
      folder: activeFolder ?? undefined,
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
    if (duplicateTag || defaultFolderSelected) return;
    const name = groupName.trim();
    setGroupSaving(true);
    setError(null);
    try {
      const availableGroups = groupDialog.kind === "folder" ? assetsData.filters.folders : assetsData.filters.tags;
      const existingGroup = availableGroups.find((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      const savedName = existingGroup?.name ?? (groupDialog.kind === "folder" ? (await createAssetFolder(name)).name : (await createAssetTag(name)).name);
      if (groupDialog.assetId) {
        const sourceAsset = assetsData.assets.find((asset) => asset.id === groupDialog.assetId);
        if (groupDialog.kind === "folder") {
          await updateAsset(groupDialog.assetId, { folder: savedName });
        } else {
          const tags = Array.from(new Map([...(sourceAsset?.tags ?? []), savedName].map((tag) => [tag.toLocaleLowerCase(), tag])).values());
          await updateAsset(groupDialog.assetId, { tags });
        }
      }
      setGroupDialog(null);
      setGroupName("");
      await refreshAfterGroupMutation();
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "Unable to save folder or tag");
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDeleteFolder = async (folder: AssetsApiFilter) => {
    const normalizedName = folder.name.trim().toLocaleLowerCase();
    if (folder.id === "all" || defaultAssetFolderNames.has(normalizedName) || busyFolderName) return;
    setBusyFolderName(folder.name);
    setPendingDeleteFolder(null);
    setError(null);
    assetsCacheRef.current.clear();
    try {
      await deleteAssetFolder(folder.name);
      if (activeFolder === folder.id) {
        setAssetsData((current) => ({
          ...current,
          filters: { ...current.filters, folders: current.filters.folders.filter((item) => item.id !== folder.id) },
        }));
        window.requestAnimationFrame(() => {
          setActiveFolder(null);
          setPage(1);
        });
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (folderError) {
      setError(folderError instanceof Error ? folderError.message : "Unable to delete folder");
    } finally {
      setBusyFolderName(null);
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

  const handleEmptyTrash = async () => {
    if (!window.confirm("Permanently delete all assets in Trash?")) return;
    setBusyAssetId("trash");
    setError(null);
    try {
      await emptyTrash();
      setRefreshKey((current) => current + 1);
    } catch (emptyError) {
      setError(emptyError instanceof Error ? emptyError.message : "Unable to empty trash");
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
    <div className="assets-page" data-active-tab={activeTab}>
      <section className="assets-hero" aria-labelledby="assets-heading">
        <div className="assets-hero-copy">
          <Image
            id="assets-heading"
            src="/generated-assets/assets-hero-banner-transparent.png"
            alt="Assets — Organize. Find. Use. Create without limits."
            width={2079}
            height={378}
            priority
            className="assets-hero-banner"
          />
          <p>All your creative assets in one place.<br />Easy to manage, search, and <strong>reuse</strong> across your projects.</p>
        </div>

        <div className="assets-summary-card">
          <div className="assets-summary-heading"><strong>ASSET SUMMARY</strong><button type="button" onClick={() => { setActiveType("All Types"); setActiveFolder(null); setActiveTag(null); setPage(1); }}>View all <ChevronRight size={17} /></button></div>
          <div className="assets-summary-grid">
            <SummaryMetric icon={<Image src={summaryIconPaths.total} alt="" width={23} height={23} />} value={assetsData.summary.total} label="Total Assets" color="#d700e8" />
            <SummaryMetric icon={<Image src={summaryIconPaths.images} alt="" width={23} height={23} />} value={assetsData.summary.images} label="Images" color="#ff3113" />
            <SummaryMetric icon={<Image src={summaryIconPaths.videos} alt="" width={23} height={23} />} value={assetsData.summary.videos} label="Videos" color="#e80091" />
            <SummaryMetric icon={<Image src={summaryIconPaths.documents} alt="" width={23} height={23} />} value={assetsData.summary.documents} label="Documents" color="#ffd000" />
            <SummaryMetric icon={<Image src={summaryIconPaths.other} alt="" width={23} height={23} />} value={assetsData.summary.others} label="Others" color="#9994a8" />
          </div>
        </div>

      </section>

      <section className="assets-library" aria-label={`${activeTab} asset library`}>
        <div className="assets-toolbar">
          <div className="assets-tabs" role="tablist" aria-label="Asset ownership">
            {tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} key={tab} className={activeTab === tab ? "is-active" : ""} onClick={() => handleTabChange(tab)}>{tab}</button>)}
          </div>
          <div className="assets-filters">
            <FilterSelect
              key="type"
              label={activeType}
              value={activeType}
              options={filterOptions.map((option) => ({ value: option, label: option }))}
              onSelect={(value) => { setActiveType(value as FilterType); setPage(1); }}
              open={openFilter === "type"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "type" : null)}
            />
            <FilterSelect
              key="folder"
              label={activeFolderLabel}
              value={activeFolder ?? ""}
              options={[{ value: "", label: "All Folders" }, ...assetsData.filters.folders.filter((item) => item.id !== "all").map((item) => ({ value: item.id, label: formatLabel(item.name), count: item.count }))]}
              onSelect={(value) => { setActiveFolder(value || null); setShowAllFolders(Boolean(value)); setPage(1); }}
              open={openFilter === "folder"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "folder" : null)}
            />
            <FilterSelect
              key="tag"
              label={activeTagLabel}
              value={activeTag ?? ""}
              options={[{ value: "", label: "All Tags" }, ...assetsData.filters.tags.map((item) => ({ value: item.id, label: formatLabel(item.name), count: item.count }))]}
              onSelect={(value) => { setActiveTag(value || null); setShowAllTags(Boolean(value)); setPage(1); }}
              open={openFilter === "tag"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "tag" : null)}
            />
            <FilterSelect
              key="sort"
              label={`Sort by: ${activeSort}`}
              value={activeSort}
              options={[{ value: "Newest", label: "Sort by: Newest" }, { value: "Oldest", label: "Sort by: Oldest" }]}
              onSelect={(value) => { setActiveSort(value as AssetSort); setPage(1); }}
              open={openFilter === "sort"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "sort" : null)}
            />
            <div className="assets-view-toggle" aria-label="Change asset view">
              <button type="button" aria-label="Grid view" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")}><Grid2X2 size={18} /></button>
              <button type="button" aria-label="List view" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}><List size={18} /></button>
            </div>
          </div>
        </div>

        <div className="assets-search-row">
          <div className="assets-inline-search"><Search size={16} /><input aria-label="Search assets" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search within assets" /></div>
          <span>{rangeLabel}</span>
        </div>

        <div className="assets-content-grid">
          <aside className="assets-sidebar-panel">
            <div className="assets-panel-heading"><strong>FOLDERS</strong><div className="assets-panel-actions"><button type="button" aria-label="Delete selected folder" title={selectedCustomFolder ? `Delete ${formatLabel(selectedCustomFolder.name)}` : "Select a custom folder to delete"} disabled={!selectedCustomFolder || busyFolderName !== null} onClick={() => { if (selectedCustomFolder) setPendingDeleteFolder(selectedCustomFolder); }}><Trash2 size={16} /></button><button type="button" aria-label="Add folder" onClick={() => openGroupDialog("folder")}><Plus size={17} /></button></div></div>
            {pendingDeleteFolder ? <div className="assets-folder-delete-popover" role="dialog" aria-label={`Confirm delete ${formatLabel(pendingDeleteFolder.name)}`}>
              <div className="assets-folder-delete-copy"><span className="assets-folder-delete-icon"><Trash2 size={16} /></span><div><strong>Delete folder?</strong><p>“{formatLabel(pendingDeleteFolder.name)}” will be removed. Assets stay in All Assets.</p></div></div>
              <div className="assets-folder-delete-actions"><button type="button" onClick={() => setPendingDeleteFolder(null)} disabled={busyFolderName !== null}>Cancel</button><button type="button" onClick={() => void handleDeleteFolder(pendingDeleteFolder)} disabled={busyFolderName !== null}>Delete</button></div>
            </div> : null}
            <div className="assets-folder-list">
              {visibleFolderItems.length ? <FilterList items={visibleFolderItems} activeId={activeFolder ?? "all"} onSelect={(id) => { setActiveFolder(id === "all" ? null : id); setPage(1); }} kind="folder" /> : <span className="assets-sidebar-empty">No folders yet</span>}
            </div>
            {folderItems.length > SIDEBAR_GROUP_LIMIT ? <button type="button" className={`assets-show-more ${showAllFolders ? "is-expanded" : ""}`} aria-expanded={showAllFolders} onClick={() => setShowAllFolders((current) => !current)}>{showAllFolders ? "Show less" : "Show more"} <ChevronDown size={14} /></button> : null}
            <div className="assets-panel-divider" />
            <div className="assets-tags-section">
              <div className="assets-panel-heading"><strong>TAGS</strong><div className="assets-panel-actions"><button type="button" aria-label="Delete selected tag" title={selectedTag ? `Delete ${formatLabel(selectedTag.name)}` : "Select a tag to delete"} disabled={!selectedTag || busyTagName !== null} onClick={() => { if (selectedTag) setPendingDeleteTag(selectedTag); }}><Trash2 size={16} /></button><button type="button" aria-label="Add tag" onClick={() => openGroupDialog("tag")}><Plus size={17} /></button></div></div>
              {pendingDeleteTag ? <div className="assets-folder-delete-popover assets-tag-delete-popover" role="dialog" aria-label={`Confirm delete ${formatLabel(pendingDeleteTag.name)}`}>
                <div className="assets-folder-delete-copy"><span className="assets-folder-delete-icon"><Trash2 size={16} /></span><div><strong>Delete tag?</strong><p>“{formatLabel(pendingDeleteTag.name)}” will be removed from your assets.</p></div></div>
                <div className="assets-folder-delete-actions"><button type="button" onClick={() => setPendingDeleteTag(null)} disabled={busyTagName !== null}>Cancel</button><button type="button" onClick={() => void handleDeleteTag(pendingDeleteTag)} disabled={busyTagName !== null}>Delete</button></div>
              </div> : null}
              <div className="assets-tag-grid">
                {visibleTagItems.length ? <FilterList items={visibleTagItems} activeId={activeTag} onSelect={(id) => { setActiveTag(id); setPage(1); }} kind="tag" /> : <span className="assets-sidebar-empty">No tags yet</span>}
              </div>
              {assetsData.filters.tags.length > SIDEBAR_GROUP_LIMIT ? <button type="button" className={`assets-show-more ${showAllTags ? "is-expanded" : ""}`} aria-expanded={showAllTags} onClick={() => setShowAllTags((current) => !current)}>{showAllTags ? "Show less" : "Show more"} <ChevronDown size={14} /></button> : null}
            </div>
          </aside>

          <div className={`${view === "grid" ? "assets-grid" : "assets-list"} ${isRefreshing ? "is-refreshing" : ""}`} aria-busy={loading || isRefreshing}>
            {loading ? Array.from({ length: 8 }, (_, index) => <div className="asset-card assets-loading-card" key={`loading-${index}`} aria-hidden="true" />) : null}
            {!loading && error ? <div className="assets-error" role="alert"><AlertCircle size={24} /><strong>Unable to load assets</strong><span>{error}</span><button type="button" onClick={() => setRefreshKey((current) => current + 1)}>TRY AGAIN</button></div> : null}
            {!loading && !error ? assets.map((asset) => <article key={asset.id} className={`asset-card ${selectedAsset === asset.id ? "is-selected" : ""} ${openMenuAsset === asset.id ? "is-menu-open" : ""}`} onClick={() => openAssetPreview(asset)}>
              <div className="asset-card-media">
                <AssetPreview asset={asset} />
                <span className="asset-type-badge" style={{ backgroundColor: typeColors[asset.type] ?? "#73768a" }}><TypeIcon kind={asset.mediaKind} />{asset.type}</span>
                {asset.playable ? <button type="button" className="asset-play" aria-label={`Play ${asset.title}`} onClick={(event) => { event.stopPropagation(); openAssetPreview(asset); }}><Play size={20} fill="white" /></button> : null}
                {asset.duration ? <span className="asset-duration">{asset.duration}</span> : null}
              </div>
              <div className="asset-card-footer"><div><strong>{asset.title}</strong><span>{asset.date} <i>•</i> {asset.size}</span></div><div className="asset-card-actions"><button type="button" aria-label={`More options for ${asset.title}`} onClick={(event) => { event.stopPropagation(); setOpenMenuAsset(openMenuAsset === asset.id ? null : asset.id); }} disabled={busyAssetId === asset.id}><MoreVertical size={18} /></button>{openMenuAsset === asset.id ? <div className="asset-card-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                <button type="button" role="menuitem" onClick={() => void handleDownload(asset)} disabled={busyAssetId === asset.id}><Download size={14} />{busyAssetId === asset.id ? "Downloading..." : "Download"}</button>
                {activeTab !== "Trash" ? <><button type="button" role="menuitem" onClick={() => openGroupDialog("folder", asset.id)}><Folder size={14} />Move to folder</button><button type="button" role="menuitem" onClick={() => openGroupDialog("tag", asset.id)}><Plus size={14} />Add tag</button></> : null}
                {activeTab === "Trash" ? <button type="button" role="menuitem" onClick={() => void handleAssetAction(asset.id, "restore")}><RotateCcw size={14} />Restore</button> : <button type="button" role="menuitem" onClick={() => void handleAssetAction(asset.id, "trash")}><Trash2 size={14} />Move to trash</button>}
              </div> : null}</div></div>
            </article>) : null}
            {!loading && !error && assets.length === 0 ? <div className="assets-empty"><Archive size={24} /><strong>No matching assets</strong><span>Try another search or filter.</span></div> : null}
          </div>
        </div>

        <div className="assets-pagination"><span>{rangeLabel}</span><div><button type="button" aria-label="Previous page" disabled={!assetsData.pagination.hasPrevious} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={18} /></button>{paginationButtons.map((value, index) => <span key={value}>{totalPages > 4 && index === paginationButtons.length - 1 ? <><span className="assets-pagination-ellipsis">…</span><button type="button" className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button></> : <button type="button" className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>}</span>)}<button type="button" aria-label="Next page" disabled={!assetsData.pagination.hasNext} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={18} /></button></div></div>
      </section>

      <section className="assets-bottom-cta" aria-label={activeTab === "Trash" ? "Trash actions" : "Upgrade plan"}>
        <Image src="/generated-assets/landing-cta-artwork-transparent.png" alt="" fill sizes="100vw" className="assets-bottom-cta-image" />
        <div className="assets-bottom-cta-copy"><strong>{cta.lineOne}<br />{cta.lineTwoPrefix}<em>{cta.accent}</em>{cta.lineTwoSuffix}</strong><span>{cta.body}</span></div>
        <button type="button" onClick={activeTab === "Trash" ? () => void handleEmptyTrash() : undefined} disabled={busyAssetId === "trash"}>{busyAssetId === "trash" ? <LoaderCircle size={18} className="animate-spin" /> : activeTab === "Trash" ? <Trash2 size={18} /> : <ExternalLink size={18} />}{busyAssetId === "trash" ? "EMPTYING..." : cta.action}</button>
      </section>

      {groupDialog ? <div className="assets-group-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeGroupDialog(); }}>
        <div className="assets-group-dialog" role="dialog" aria-modal="true" aria-labelledby="assets-group-dialog-title">
          <div className="assets-group-dialog-heading"><strong id="assets-group-dialog-title">{groupDialog.assetId ? groupDialog.kind === "folder" ? "Move to folder" : "Add tag" : groupDialog.kind === "folder" ? "Create folder" : "Create tag"}</strong><button type="button" onClick={closeGroupDialog} disabled={groupSaving} aria-label="Close">×</button></div>
          {groupDialog.assetId ? <div className="assets-group-options">
            {groupOptions.length ? groupOptions.map((item) => <button type="button" key={item.id} className={groupName === item.name ? "is-selected" : ""} onClick={() => setGroupName(item.name)}>{formatLabel(item.name)}<span>{formatCount(item.count)}</span></button>) : <span className="assets-group-options-empty">{groupDialog.kind === "tag" ? "No available tags for this asset." : "No custom folders yet."}</span>}
          </div> : null}
          <input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder={groupDialog.kind === "folder" ? "Folder name" : "Tag name"} maxLength={120} onKeyDown={(event) => { if (event.key === "Enter") void handleSaveGroup(); }} />
          {duplicateTag ? <span className="assets-group-dialog-error" role="alert">This asset already has this tag.</span> : null}
          {defaultFolderSelected ? <span className="assets-group-dialog-error" role="alert">Default folders cannot be selected here.</span> : null}
          <div className="assets-group-dialog-actions"><button type="button" onClick={closeGroupDialog} disabled={groupSaving}>Cancel</button><button type="button" onClick={() => void handleSaveGroup()} disabled={groupSaving || !groupName.trim() || duplicateTag || defaultFolderSelected}>{groupSaving ? "Saving..." : groupDialog.assetId ? "Save" : "Create"}</button></div>
        </div>
      </div> : null}
      {previewAsset ? <AssetPreviewPopup asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </div>
  );
}
