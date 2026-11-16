"use client";

import Image from "next/image";
import "./assets-universe.css";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EosVideoPlayer } from "@/components/media/eos-video-player";
import { VideoFrameThumbnail } from "@/components/media/video-frame-thumbnail";
import { SearchInput } from "@/components/ui/search-input";
import { isAssetTypeSelected, selectAssetType } from "@/features/assets/asset-type-filter";
import { isSystemAssetFolder, isUnfiledAssetFolder } from "@/features/assets/asset-folders";
import { useStudioCopy, type StudioCopyKey } from "@/lib/i18n/studio-copy";
import { fetchAudioHistoryAudio, listOwnedAudioAssets, type AudioHistoryEntry } from "@/lib/api/audio";
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
  Folder,
  FolderPlus,
  Grid2X2,
  Image as ImageIcon,
  List,
  MoreVertical,
  Play,
  RotateCcw,
  Trash2,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  deleteAsset,
  downloadAsset,
  fetchAssets,
  createAssetFolder,
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
  size: string | null;
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

type MediaTab = { value: FilterType; Icon: LucideIcon | null };

const mediaTabs: MediaTab[] = [
  { value: "All Types", Icon: null },
  { value: "Images", Icon: ImageIcon },
  { value: "Videos", Icon: Video },
  { value: "Audio", Icon: AudioLines },
  { value: "Documents", Icon: FileText },
];
const mediaTabKeys: Partial<Record<FilterType, StudioCopyKey>> = {
  "All Types": "assets.tab.all",
  Images: "assets.tab.images",
  Videos: "assets.tab.videos",
  Audio: "assets.tab.audio",
  Documents: "assets.tab.documents",
};

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
  JPG: "#0bca84",
  JPEG: "#0bca84",
  PNG: "#0bca84",
  WEBP: "#0bca84",
  MP4: "#ef0093",
  WEBM: "#ef0093",
  MOV: "#ef0093",
  PDF: "#f20b26",
  AI: "#6f17d9",
  PPT: "#ff5e0b",
  PPTX: "#ff5e0b",
  MP3: "#7f0ec1",
  WAV: "#7f0ec1",
  DOC: "#44a8d8",
  DOCX: "#44a8d8",
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

function formatDate(value: string, locale: "th" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : undefined;
}

function mapApiAsset(asset: AssetsApiAsset, locale: "th" | "en", untitled: string): Asset {
  const extension = asset.fileExtension?.replace(/^\./, "").toUpperCase();
  const type = extension || formatLabel(asset.type).toUpperCase();
  return {
    id: asset.id,
    title:
      /^(create a high-quality image|preserve the entire original image|upscale the provided image|continue the source image|create a coherent video that follows the user instruction)/i.test(
        asset.title.trim(),
      )
        ? metadataString(asset.metadata, "userPrompt") || untitled
        : asset.title,
    date: formatDate(asset.createdAt, locale),
    size: asset.sizeBytes === 0 ? null : asset.sizeLabel || (asset.sizeBytes == null ? null : formatBytes(asset.sizeBytes)),
    type,
    image:
      asset.previewUrl ??
      (asset.type === "image" && asset.url
        ? asset.url
        : asset.type === "video" && asset.url
          ? asset.url
          : previewFallbacks[asset.type]),
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

type FolderDialog = {
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
  return (
    <div className="asset-audio-preview" aria-hidden="true">
      <span className="asset-audio-preview-glow" />
      <Image
        src="/generated-assets/audio-ui/audio-waveform.png"
        alt=""
        fill
        sizes="(max-width: 767px) 90vw, 30vw"
        unoptimized
        className="asset-audio-waveform"
      />
      <span className="asset-audio-preview-label">
        <AudioLines size={13} /> AUDIO
      </span>
    </div>
  );
}

function OwnedAudioHistory({ search, sort }: { search: string; sort: AssetSort }) {
  const [items, setItems] = useState<AudioHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / 12));

  useEffect(() => { return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }; }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listOwnedAudioAssets({ page, limit: 12, search, sort: sort === "Oldest" ? "oldest" : "newest" })
        .then((result) => { if (active) { setItems(result.items); setTotal(result.total); } })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "โหลดประวัติเสียงไม่สำเร็จ"); })
        .finally(() => { if (active) setLoading(false); });
    }, search.trim() ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, search, sort]);

  const openAudio = async (item: AudioHistoryEntry, download: boolean) => {
    if (busy) return;
    setBusy(item.id);
    setError(null);
    try {
      const { blob } = await fetchAudioHistoryAudio(item.id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(item.label || "audio").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 100)}.${item.outputFormat}`;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreview({ title: item.label, url });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เปิดไฟล์เสียงไม่สำเร็จ"); }
    finally { setBusy(null); }
  };
  const closePreview = () => { setPreview(null); if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; };
  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setPreview(null); if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  return <section className="owned-audio-history" aria-label="ประวัติเสียงของคุณ">
    <div className="owned-audio-history-heading"><strong>ประวัติเสียงของคุณ</strong><span>แสดงเฉพาะคุณ · ไฟล์หมดอายุตามระยะเวลาเก็บประวัติ</span></div>
    {loading ? <p>กำลังโหลดประวัติเสียง…</p> : error ? <p role="alert">{error}</p> : items.length ? <div className="assets-grid">{items.map((item) => <article key={item.id} className="asset-card">
      <div className="asset-card-media"><AudioAssetPreview /><span className="asset-type-badge" style={{ backgroundColor: "#73768a" }}><AudioLines size={15} />เสียง</span><button type="button" className="asset-play" disabled={busy !== null} aria-label={`ฟัง ${item.label}`} onClick={() => void openAudio(item, false)}><Play size={20} fill="white" /></button></div>
      <div className="asset-card-footer"><div><strong>{item.label}</strong><span>{new Date(item.createdAt).toLocaleDateString("th-TH")}</span></div><div className="asset-card-actions"><button type="button" disabled={busy !== null} aria-label={`ดาวน์โหลด ${item.label}`} onClick={() => void openAudio(item, true)}><Download size={17} /></button></div></div>
    </article>)}</div> : <p>ไม่มีประวัติเสียงที่ตรงกัน</p>}
    {total > 12 ? <div className="assets-pagination"><span>หน้า {page} / {totalPages} · {total} รายการ</span><div><button type="button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}><ChevronLeft size={18} /></button><button type="button" aria-label="หน้าถัดไป" disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}><ChevronRight size={18} /></button></div></div> : null}
    {preview ? <div className="assets-preview-popup" role="dialog" aria-modal="true" aria-label={preview.title} onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}><div className="assets-preview-popup-content"><button type="button" className="assets-preview-popup-close" onClick={closePreview} aria-label="ปิด"><X size={20} /></button><div className="assets-preview-popup-audio"><AudioLines size={34} /><strong>{preview.title}</strong><audio src={preview.url} controls autoPlay aria-label={preview.title} /></div></div></div> : null}
  </section>;
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

  return (
    <div className={`assets-select ${open ? "is-open" : ""}`} ref={selectRef}>
      <button
        type="button"
        className="assets-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => onToggle(!open)}
      >
        <span>{label}</span>
        <ChevronDown className="assets-select-chevron" size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div className="assets-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={`assets-select-option ${selected ? "is-selected" : ""}`}
                value={option.value}
                key={option.value || "all"}
                onClick={() => {
                  onSelect(option.value);
                  onToggle(false);
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AssetPreview({ asset }: { asset: Asset }) {
  const { c } = useStudioCopy();
  if (asset.mediaKind === "audio") return <AudioAssetPreview />;
  if (asset.mediaKind === "video" && asset.url && asset.image === asset.url) {
    return (
      <VideoFrameThumbnail
        key={asset.url}
        src={asset.url}
        alt={c("assets.preview.alt", { title: asset.title })}
        className="asset-preview-video"
        fallback={
          <span className="flex h-full w-full items-center justify-center text-white/70">
            <Video size={32} />
          </span>
        }
      />
    );
  }
  return <Image src={asset.image} alt="" fill sizes="(max-width: 1100px) 50vw, 22vw" loading="lazy" unoptimized />;
}

function AssetPreviewPopup({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const { c } = useStudioCopy();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const source = asset.url ?? asset.image;
  if (asset.mediaKind === "video" && asset.url) {
    return (
      <div
        className="video-modal assets-video-modal"
        role="dialog"
        aria-modal="true"
        aria-label={c("assets.preview.aria", { title: asset.title })}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="video-modal-shell assets-video-modal-shell" onMouseDown={(event) => event.stopPropagation()}>
          <div className="video-modal-actions">
            <button type="button" className="video-modal-close" onClick={onClose} aria-label={c("assets.preview.close")}>
              <X size={22} />
            </button>
          </div>
          <EosVideoPlayer src={asset.url} autoPlay ariaLabel={asset.title} />
        </div>
      </div>
    );
  }
  return (
    <div
      className="assets-preview-popup"
      role="dialog"
      aria-modal="true"
      aria-label={c("assets.preview.aria", { title: asset.title })}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="assets-preview-popup-content">
        <button type="button" className="assets-preview-popup-close" onClick={onClose} aria-label={c("assets.preview.close")}>
          <X size={20} />
        </button>
        {asset.mediaKind === "audio" && asset.url ? (
          <div className="assets-preview-popup-audio">
            <AudioLines size={34} />
            <strong>{asset.title}</strong>
            <audio src={asset.url} controls autoPlay aria-label={asset.title} />
          </div>
        ) : null}
        {asset.mediaKind === "document" && asset.url ? (
          <iframe className="assets-preview-popup-frame" src={asset.url} title={asset.title} />
        ) : null}
        {asset.mediaKind !== "video" &&
        asset.mediaKind !== "audio" &&
        !(asset.mediaKind === "document" && asset.url) ? (
          <div className="assets-preview-popup-image-wrap">
            <Image
              className="assets-preview-popup-image"
              src={source}
              alt={asset.title}
              fill
              sizes="94vw"
              unoptimized
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

type FolderListProps = {
  items: AssetsApiFilter[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
};

function FolderList({ items, activeId, onSelect }: FolderListProps) {
  return (
    <>
      {items.map((item) => {
        const isActive = activeId === item.id;
        const label = item.name;

        return (
          <span className="assets-tag-chip" key={item.id}>
            <button
              type="button"
              className={`assets-tag-chip-main ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? null : item.id)}
            >
              <Folder size={15} aria-hidden="true" /> <span>{label}</span>
              <b>{formatCount(item.count)}</b>
            </button>

          </span>
        );
      })}
    </>
  );
}

export default function AssetsPage() {
  const { c, locale } = useStudioCopy();
  const queryParams = useSearchParams();
  const searchRef = useRef(queryParams.get("q") ?? "");
  const [activeTab] = useState<AssetTab>("My Assets");
  const [activeType, setActiveType] = useState<FilterType>("All Types");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<AssetSort>("Newest");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [search, setSearch] = useState(() => queryParams.get("q") ?? "");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [openMenuAsset, setOpenMenuAsset] = useState<string | null>(null);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [groupDialog, setGroupDialog] = useState<FolderDialog | null>(null);
  const [groupName, setGroupName] = useState("");
  const [removeFromFolder, setRemoveFromFolder] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
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
      folder: activeFolder,
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
          recentOnly: true,
          type: apiTypeByFilter[activeType],
          search: search.trim(),
          folder: activeFolder ?? undefined,
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
          setError(
            hadPreviousData ? null : requestError instanceof Error ? requestError.message : "Unable to load assets",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };
    const timeoutId = window.setTimeout(
      () => {
        void load();
      },
      search.trim() ? 220 : 0,
    );
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeSort, activeTab, activeFolder, activeType, page, refreshKey, search]);

  useEffect(() => {
    const refreshGeneratedAssets = () => {
      if (activeTab !== "My Assets") return;
      setRefreshKey((current) => current + 1);
    };
    window.addEventListener("eos:generation-completed", refreshGeneratedAssets);
    return () => window.removeEventListener("eos:generation-completed", refreshGeneratedAssets);
  }, [activeTab]);

  const untitledAsset = c("assets.untitled");
  const assets = useMemo(
    () => assetsData.assets.filter((asset) => asset.source === "generated").map((asset) => mapApiAsset(asset, locale, untitledAsset)),
    [assetsData.assets, locale, untitledAsset],
  );
  const userFolders = assetsData.filters.folders.filter((item) => !isSystemAssetFolder(item.name));
  const visibleFolderItems = showAllFolders ? userFolders : userFolders.slice(0, SIDEBAR_GROUP_LIMIT);
  const totalPages = Math.max(1, assetsData.pagination.totalPages || 1);
  const groupAsset = groupDialog?.assetId ? assets.find((asset) => asset.id === groupDialog.assetId) : null;
  const groupOptions = userFolders;
  const duplicateFolder = !groupDialog?.assetId && (isSystemAssetFolder(groupName) || assetsData.filters.folders.some((item) => item.name.toLocaleLowerCase() === groupName.trim().toLocaleLowerCase()));
  const unchangedFolder = Boolean(groupDialog?.assetId) && (removeFromFolder ? isUnfiledAssetFolder(groupAsset?.folder) : groupAsset?.folder === groupName);
  const startItem =
    assetsData.pagination.total === 0 ? 0 : (assetsData.pagination.page - 1) * assetsData.pagination.limit + 1;
  const endItem = Math.min(assetsData.pagination.total, startItem + assetsData.pagination.limit - 1);
  const rangeLabel =
    assetsData.pagination.total === 0
      ? c("assets.range.none")
      : c("assets.range.showing", { from: startItem, to: endItem, total: formatCount(assetsData.pagination.total) });

  const openFolderDialog = (assetId: string | null = null) => {
    setOpenFilter(null);
    setOpenMenuAsset(null);
    setGroupError(null);
    const currentFolder = assetId ? assets.find((asset) => asset.id === assetId)?.folder ?? "" : "";
    setGroupName(isSystemAssetFolder(currentFolder) ? "" : currentFolder);
    setRemoveFromFolder(Boolean(assetId) && isUnfiledAssetFolder(currentFolder));
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
      recentOnly: true,
      type: apiTypeByFilter[activeType],
      search,
      folder: activeFolder ?? undefined,
      sort: activeSort.toLowerCase() as "newest" | "oldest",
      page: 1,
      limit: 12,
    });
    setPage(1);
    if (activeTab === "My Assets") setAssetsData(nextMineData);
    else setRefreshKey((current) => current + 1);
  };

  const handleSaveGroup = async () => {
    if (!groupDialog || (!groupName.trim() && !(groupDialog.assetId && removeFromFolder))) return;
    if (duplicateFolder || unchangedFolder) return;
    const name = groupName.trim();
    setGroupSaving(true);
    setGroupError(null);
    setError(null);
    try {
      if (groupDialog.assetId) {
        await updateAsset(groupDialog.assetId, { folder: removeFromFolder ? null : name });
      } else await createAssetFolder(name);
      await refreshAfterGroupMutation();
      setGroupDialog(null);
      setGroupName("");
    } catch (folderError) {
      setGroupError(folderError instanceof Error ? folderError.message : "Unable to save folder");
    } finally {
      setGroupSaving(false);
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

  const paginationButtons =
    totalPages <= 4 ? Array.from({ length: totalPages }, (_, index) => index + 1) : [1, 2, 3, totalPages];

  return (
    <div className="assets-page" data-active-tab={activeTab} data-no-translate>
      <section className="studio-hero-frame assets-universe-hero" aria-label={c("assets.heroAria")}>
        <picture>
          <source media="(max-width: 767.98px)" srcSet="/generated-assets/studio-heroes-v4/assets-mobile.webp" />
          <Image
            src="/generated-assets/studio-heroes-v4/assets-desktop.webp"
            alt={c("assets.heroAlt")}
            width={2400}
            height={435}
            priority
            className="assets-universe-full-art"
            sizes="100vw"
          />
        </picture>
      </section>
      <div className="assets-retention-notice" role="note">
        <Clock3 size={16} aria-hidden="true" />
        <span>{c("assets.retention")}</span>
      </div>

      <section className="assets-library" aria-label={c("assets.libraryAria")}>
        <div className="assets-toolbar">
          <div className="assets-media-tabs" role="group" aria-label={c("assets.typeGroupAria")}>
            {visibleMediaTabs.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={isAssetTypeSelected(value, activeType, activeFolder)}
                className={isAssetTypeSelected(value, activeType, activeFolder) ? "is-active" : ""}
                onClick={() => {
                  const selection = selectAssetType(value, activeFolder);
                  setActiveType(selection.type);
                  setActiveFolder(selection.tag);
                  setPage(1);
                }}
              >
                {Icon ? <Icon size={16} /> : null}
                {c(mediaTabKeys[value] ?? "assets.tab.all")}
              </button>
            ))}
          </div>

          <div className="assets-tag-strip" aria-label={c("assets.foldersAria")}>
            <span className="assets-tag-strip-divider" aria-hidden="true" />

            <FolderList
              items={visibleFolderItems}
              activeId={activeFolder}
              onSelect={(id) => {
                setActiveFolder(id);
                setPage(1);
              }}
            />
            {userFolders.length > SIDEBAR_GROUP_LIMIT ? (
              <button
                type="button"
                className={`assets-show-more ${showAllFolders ? "is-expanded" : ""}`}
                aria-expanded={showAllFolders}
                onClick={() => setShowAllFolders((current) => !current)}
              >
                {showAllFolders ? c("assets.showLess") : c("assets.showAll")} <ChevronDown size={14} />
              </button>
            ) : null}

            <button type="button" className="assets-add-tag" onClick={() => openFolderDialog()}>
              <FolderPlus size={16} /> {c("assets.folder.create")}
            </button>
          </div>
          <div className="assets-filters">
            <FilterSelect
              key="sort"
              label={activeSort === "Newest" ? c("assets.sort.newest") : c("assets.sort.oldest")}
              value={activeSort}
              options={[
                { value: "Newest", label: c("assets.sort.newest") },
                { value: "Oldest", label: c("assets.sort.oldest") },
              ]}
              onSelect={(value) => {
                setActiveSort(value as AssetSort);
                setPage(1);
              }}
              open={openFilter === "sort"}
              onToggle={(nextOpen) => setOpenFilter(nextOpen ? "sort" : null)}
            />
            <div className="assets-view-toggle" aria-label={c("assets.viewToggleAria")}>
              <button
                type="button"
                aria-label={c("assets.viewGrid")}
                className={view === "grid" ? "is-active" : ""}
                onClick={() => setView("grid")}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                type="button"
                aria-label={c("assets.viewList")}
                className={view === "list" ? "is-active" : ""}
                onClick={() => setView("list")}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="assets-search-row">
          <SearchInput
            className="w-full sm:w-57.5"
            aria-label={c("assets.searchAria")}
            value={search}
            onValueChange={setSearch}
            placeholder={c("assets.searchPlaceholder")}
          />
          <span>{activeType === "Audio" && !activeFolder && assets.length === 0 ? "" : rangeLabel}</span>
        </div>

        {activeFolder ? <p className="assets-folder-note" role="note">{c("assets.folder.audioHistoryNote")}</p> : null}
        {activeTab === "My Assets" && activeType === "Audio" && !activeFolder ? <OwnedAudioHistory key={`${search}:${activeSort}:${refreshKey}`} search={search} sort={activeSort} /> : null}
        <div className="assets-content-grid">
          <div
            className={`${view === "grid" ? "assets-grid" : "assets-list"} ${isRefreshing ? "is-refreshing" : ""}`}
            aria-busy={loading || isRefreshing}
          >
            {loading
              ? Array.from({ length: 8 }, (_, index) => (
                  <div className="asset-card assets-loading-card" key={`loading-${index}`} aria-hidden="true" />
                ))
              : null}
            {!loading && error ? (
              <div className="assets-error" role="alert">
                <AlertCircle size={24} />
                <strong>{c("assets.loadFailed")}</strong>
                <span>{error}</span>
                <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
                  {c("assets.retry")}
                </button>
              </div>
            ) : null}
            {!loading && !error
              ? assets.map((asset) => (
                  <article
                    key={asset.id}
                    className={`asset-card ${selectedAsset === asset.id ? "is-selected" : ""} ${openMenuAsset === asset.id ? "is-menu-open" : ""}`}
                    tabIndex={0}
                    aria-label={c("assets.card.viewAria", { title: asset.title })}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openAssetPreview(asset);
                      }
                    }}
                    onClick={() => openAssetPreview(asset)}
                  >
                    <div className="asset-card-media">
                      <AssetPreview asset={asset} />
                      <span
                        className="asset-type-badge"
                        style={{ backgroundColor: typeColors[asset.type] ?? "#73768a" }}
                      >
                        <TypeIcon kind={asset.mediaKind} />
                        {asset.type}
                      </span>
                      {asset.playable ? (
                        <button
                          type="button"
                          className="asset-play"
                          aria-label={c("assets.card.playAria", { title: asset.title })}
                          onClick={(event) => {
                            event.stopPropagation();
                            openAssetPreview(asset);
                          }}
                        >
                          <Play size={20} fill="white" />
                        </button>
                      ) : null}
                      {asset.duration ? <span className="asset-duration">{asset.duration}</span> : null}
                    </div>
                    <div className="asset-card-footer">
                      <div>
                        <strong>{asset.title}</strong>
                        <span>
                          {asset.date}{asset.size ? <> <i>•</i> {asset.size}</> : null}
                        </span>
                      </div>
                      <div className="asset-card-actions">
                        <button
                          type="button"
                          aria-label={c("assets.card.downloadAria", { title: asset.title })}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownload(asset);
                          }}
                          disabled={busyAssetId === asset.id}
                        >
                          <Download size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={c("assets.card.moreAria", { title: asset.title })}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuAsset(openMenuAsset === asset.id ? null : asset.id);
                          }}
                          disabled={busyAssetId === asset.id}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openMenuAsset === asset.id ? (
                          <div className="asset-card-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void handleDownload(asset)}
                              disabled={busyAssetId === asset.id}
                            >
                              <Download size={14} />
                              {busyAssetId === asset.id ? c("assets.card.downloading") : c("assets.card.download")}
                            </button>
                            {activeTab !== "Trash" ? (
                              <button type="button" role="menuitem" onClick={() => openFolderDialog(asset.id)}>
                                <Folder size={14} />
                                {c("assets.folder.move")}
                              </button>
                            ) : null}
                            {activeTab === "Trash" ? (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => void handleAssetAction(asset.id, "restore")}
                              >
                                <RotateCcw size={14} />
                                {c("assets.card.restore")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => void handleAssetAction(asset.id, "trash")}
                              >
                                <Trash2 size={14} />
                                {c("assets.card.trash")}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              : null}
            {!loading && !error && assets.length === 0 && !(activeType === "Audio" && !activeFolder) ? (
              <div className="assets-empty">
                <Archive size={24} />
                <strong>{c("assets.empty.title")}</strong>
                <span>{c("assets.empty.body")}</span>
              </div>
            ) : null}
          </div>
        </div>

        {!(activeType === "Audio" && !activeFolder && assets.length === 0) ? <div className="assets-pagination">
          <span>{rangeLabel}</span>
          <div>
            <button
              type="button"
              aria-label={c("assets.page.prev")}
              disabled={!assetsData.pagination.hasPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={18} />
            </button>
            {paginationButtons.map((value, index) => (
              <span key={value} className="assets-pagination-page">
                {totalPages > 4 && index === paginationButtons.length - 1 ? (
                  <span className="assets-pagination-ellipsis" aria-hidden="true">
                    …
                  </span>
                ) : null}
                <button type="button" className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>
                  {value}
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label={c("assets.page.next")}
              disabled={!assetsData.pagination.hasNext}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div> : null}
      </section>

      {groupDialog ? (
        <div
          className="assets-group-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeGroupDialog();
          }}
        >
          <div
            className="assets-group-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assets-group-dialog-title"
          >
            <div className="assets-group-dialog-heading">
              <strong id="assets-group-dialog-title">{groupDialog.assetId ? c("assets.folder.move") : c("assets.folder.create")}</strong>
              <button type="button" onClick={closeGroupDialog} disabled={groupSaving} aria-label={c("assets.dialog.close")}>
                ×
              </button>
            </div>
            {groupDialog.assetId ? (
              <div className="assets-group-options">
                <button type="button" className={removeFromFolder ? "is-selected" : ""} onClick={() => { setRemoveFromFolder(true); setGroupName(""); }}>
                  {c("assets.folder.unassigned")}
                </button>
                {groupOptions.length ? (
                  groupOptions.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={!removeFromFolder && groupName === item.name ? "is-selected" : ""}
                      onClick={() => { setRemoveFromFolder(false); setGroupName(item.name); }}
                    >
                      {item.name}
                      <span>{formatCount(item.count)}</span>
                    </button>
                  ))
                ) : (
                  <span className="assets-group-options-empty">{c("assets.folder.none")}</span>
                )}
              </div>
            ) : null}
            {!groupDialog.assetId ? (
              <input
                autoFocus
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder={c("assets.folder.name")}
                maxLength={120}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSaveGroup();
                }}
              />
            ) : null}
            {duplicateFolder ? (
              <span className="assets-group-dialog-error" role="alert">
                {c("assets.folder.duplicate")}
              </span>
            ) : null}
            {groupError ? <span className="assets-group-dialog-error" role="alert">{groupError}</span> : null}
            <div className="assets-group-dialog-actions">
              <button type="button" onClick={closeGroupDialog} disabled={groupSaving}>
                {c("assets.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveGroup()}
                disabled={groupSaving || (!groupName.trim() && !(groupDialog.assetId && removeFromFolder)) || duplicateFolder || unchangedFolder}
              >
                {groupSaving ? c("assets.dialog.saving") : groupDialog.assetId ? c("assets.dialog.save") : c("assets.dialog.create")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewAsset ? <AssetPreviewPopup asset={previewAsset} onClose={() => setPreviewAsset(null)} /> : null}
    </div>
  );
}
