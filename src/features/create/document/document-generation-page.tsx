"use client";

import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CloudUpload,
  Download,
  FileCheck2,
  FileText,
  Hand,
  Languages,
  ListChecks,
  NotebookPen,
  Play,
  Plus,
  ScanText,
  Sparkles,
  Table2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Fragment } from "react";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./document-generation-page.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;

const modes = [
  { key: K("mode.ocr"), icon: ScanText, active: true },
  { key: K("mode.summarize"), icon: NotebookPen },
  { key: K("mode.translate"), icon: Languages },
  { key: K("mode.contract"), icon: FileCheck2 },
  { key: K("mode.report"), icon: BarChart3 },
  { key: K("mode.form"), icon: ListChecks },
];

const outputs = [
  { key: K("output.summary"), icon: NotebookPen },
  { key: K("output.keyFields"), icon: ListChecks },
  { key: K("output.table"), icon: Table2 },
  { key: K("output.translated"), icon: Languages },
  { key: K("output.notes"), icon: Sparkles },
];

const guides = [
  { title: K("guide.ocr"), detail: K("guide.ocrDetail"), time: "03:21", tone: "orange" },
  { title: K("guide.contract"), detail: K("guide.contractDetail"), time: "04:35", tone: "pink" },
  { title: K("guide.prompt"), detail: K("guide.promptDetail"), time: "05:12", tone: "yellow" },
  { title: K("guide.reports"), detail: K("guide.reportsDetail"), time: "06:08", tone: "blue" },
];

const documentTools = [
  { title: K("tool.ocr"), detail: K("tool.ocrDetail"), icon: ScanText },
  { title: K("tool.contract"), detail: K("tool.contractDetail"), icon: FileCheck2 },
  { title: K("tool.meeting"), detail: K("tool.meetingDetail"), icon: NotebookPen },
  { title: K("tool.report"), detail: K("tool.reportDetail"), icon: BarChart3 },
];

/** Renders a translated string, turning "\n" into line breaks (used by the hero artwork). */
function Lines({ text }: { text: string }) {
  return text.split("\n").map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

function PanelHeading({ step, children }: { step: string; children: string }) {
  return (
    <div className={styles.panelHeading}>
      <span>{step}.</span>
      <h2>{children}</h2>
    </div>
  );
}

function SelectPlaceholder({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.selectField}>
      <span>{label}</span>
      <div className={styles.selectValue}>
        {value}
        <ChevronDown size={14} aria-hidden="true" />
      </div>
    </div>
  );
}

export function DocumentGenerationPage() {
  const { t } = useLocale();
  return (
    <div className={`${styles.page} document-studio-page`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>EOS CREATIVE STUDIO</span>
          <h1>GEN DOCUMENT</h1>
          <div className={styles.heroStamp}>{t(K("hero.stamp"))}</div>
          <p>{t(K("hero.tagline"))}</p>
        </div>
        <div className={styles.heroArtwork} aria-hidden="true">
          <div className={styles.heroBrush}><Lines text={t(K("hero.brush"))} /></div>
          <div className={`${styles.paper} ${styles.paperBack}`}>
            <span>{t(K("hero.paper"))}</span>
            <i /><i /><i />
            <div className={styles.miniChart}><b /><b /><b /><b /><b /></div>
          </div>
          <div className={styles.smartSticker}><Lines text={t(K("hero.sticker"))} /></div>
          <div className={`${styles.paper} ${styles.paperFront}`}>
            <span>OCR</span>
            <i /><i /><i /><i />
            <div className={styles.scanCorners} />
          </div>
          <div className={styles.orangeBurst} />
        </div>
      </header>

      <CreatorWorkspaceLayout
        tabs={
          <nav className={styles.modeTabs} aria-label={t(K("a11y.tools"))}>
            {modes.map(({ key, icon: Icon, active }) => (
              <button key={key} type="button" className={`${styles.modeTab} ${active ? styles.modeTabActive : ""}`} aria-pressed={active}>
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                <span>{t(key)}</span>
              </button>
            ))}
          </nav>
        }
        left={
          <aside className={styles.sourcePanel} aria-label={t(K("a11y.source"))}>
          <PanelHeading step="1">{t(K("source.heading"))}</PanelHeading>
          <div className={styles.dropzone}>
            <CloudUpload size={29} strokeWidth={1.7} aria-hidden="true" />
            <strong>{t(K("source.dropTitle"))}</strong>
            <span>{t(K("source.dropHint"))}</span>
            <small>{t(K("source.dropTypes"))}</small>
          </div>
          <div className={styles.filePlaceholder}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>{t(K("source.filesTitle"))}</strong><small>{t(K("source.filesHint"))}</small></span>
            <Plus size={16} aria-hidden="true" />
          </div>
          <SelectPlaceholder label={t(K("source.pages"))} value={t(K("source.allPages"))} />
          <div className={styles.sectionRule} />
          <PanelHeading step="2">{t(K("instructions.heading"))}</PanelHeading>
          <div className={styles.instructionPlaceholder}>
            <span>{t(K("instructions.placeholder"))}</span>
            <small>0 / 600</small>
          </div>
          <div className={styles.checkList}>
            <div><i className={styles.checkedBox} />{t(K("instructions.extractTables"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.handwriting"))}</div>
            <div><i className={styles.checkedBox} />{t(K("instructions.layout"))}</div>
          </div>
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label={t(K("a11y.preview"))}>
          <div className={styles.previewHeader}>
            <div><span>{t(K("preview.heading"))}</span><small>{t(K("preview.canvas"))}</small></div>
            <div className={styles.previewToolbar} aria-label={t(K("preview.controls"))}>
              <ZoomIn size={14} aria-hidden="true" />
              <ZoomOut size={14} aria-hidden="true" />
              <span>100% <ChevronDown size={12} /></span>
              <Hand size={14} aria-hidden="true" />
              <span className={styles.toolbarDivider} />
              <span>{t(K("preview.compare"))}</span>
              <span>{t(K("preview.annotate"))}</span>
              <span><Download size={13} />{t(K("preview.export"))}</span>
            </div>
          </div>

          <div className={styles.previewStage}>
            <div className={styles.pageRail} aria-hidden="true">
              {[1, 2, 3, 4].map((page) => (
                <div key={page} className={`${styles.pageThumb} ${page === 1 ? styles.pageThumbActive : ""}`}>
                  <span>{page}</span>
                  <div><i /><i /><i /></div>
                </div>
              ))}
            </div>
            <div className={styles.canvas}>
              <div className={styles.documentSheet} aria-hidden="true">
                <div className={styles.sheetTopline}><span /><span>{t(K("preview.sheetLabel"))}</span></div>
                <div className={styles.sheetTitle} />
                <div className={styles.sheetSubtitle} />
                <div className={styles.sheetParagraph}><i /><i /><i /><i /></div>
                <div className={styles.sheetDataRow}>
                  <div className={styles.sheetTable}><i /><i /><i /><i /><i /><i /></div>
                  <div className={styles.sheetChart}><b /><b /><b /><b /><b /></div>
                </div>
                <div className={styles.sheetParagraph}><i /><i /><i /></div>
              </div>
              <div className={styles.canvasEmptyState}>
                <span><FileText size={22} aria-hidden="true" /></span>
                <strong>{t(K("preview.emptyTitle"))}</strong>
                <small>{t(K("preview.emptyHint"))}</small>
              </div>
              <div className={styles.canvasPageNumber}>{t(K("preview.pageOf"))}</div>
            </div>
          </div>

          <div className={styles.outputCards}>
            {outputs.map(({ key, icon: Icon }) => (
              <div className={styles.outputCard} key={key}>
                <div className={styles.outputTitle}><Icon size={13} aria-hidden="true" /><strong>{t(key)}</strong></div>
                <i /><i /><i />
                <small>{t(K("output.pending"))}</small>
              </div>
            ))}
          </div>
          </main>
        }
        right={
          <aside className={styles.settingsPanel} aria-label={t(K("a11y.settings"))}>
          <PanelHeading step="3">{t(K("settings.heading"))}</PanelHeading>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.model"))} <span>ⓘ</span></div>
            <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>{t(K("settings.standard"))}</strong><small>{t(K("settings.standardHint"))}</small></div>
              <div className={styles.modelCard}><i /><strong>{t(K("settings.premium"))}</strong><small>{t(K("settings.premiumHint"))}</small></div>
            </div>
          </div>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>{t(K("settings.outputFormat"))}</div>
            <div className={styles.formatCards}>
              {["DOCX", "PDF", "TXT", "JSON"].map((format, index) => (
                <div key={format} className={`${styles.formatCard} ${index === 0 ? styles.formatCardActive : ""}`}>
                  <FileText size={18} aria-hidden="true" /><span>{format}</span>
                </div>
              ))}
            </div>
          </div>
          <SelectPlaceholder label={t(K("settings.language"))} value={t(K("settings.languageValue"))} />
          <SelectPlaceholder label={t(K("settings.pageRange"))} value={t(K("source.allPages"))} />
          <SelectPlaceholder label={t(K("settings.depth"))} value={t(K("settings.depthValue"))} />
          <SelectPlaceholder label={t(K("settings.tone"))} value={t(K("settings.toneValue"))} />
          <div className={styles.estimate}><span>{t(K("settings.estimate"))}</span><strong>{t(K("settings.credits"))}</strong></div>
          <div className={styles.generateButton} aria-disabled="true"><span>{t(K("settings.generate"))}</span><Sparkles size={17} aria-hidden="true" /></div>
          <div className={styles.secureNote}><span />{t(K("settings.secure"))}</div>
          </aside>
        }
      />

      <section className={styles.resourceShelf} aria-label={t(K("a11y.shelf"))}>
        <div className={styles.learnArea}>
          <div className={styles.shelfHeading}>
            <div><h2>{t(K("learn.heading"))}</h2><p>{t(K("learn.subheading"))}</p></div>
            <a href="#document-guides">{t(K("learn.viewAll"))} <ArrowUpRight size={13} aria-hidden="true" /></a>
          </div>
          <div className={styles.guideCards} id="document-guides">
            {guides.map((guide) => (
              <div className={styles.guideCard} key={guide.time}>
                <div className={`${styles.guideThumb} ${styles[`guideTone_${guide.tone}`]}`}>
                  <span>{t(guide.title)}</span><Play size={14} fill="currentColor" aria-hidden="true" />
                </div>
                <strong>{t(guide.title)}</strong>
                <small>{t(guide.detail)}</small>
                <em>{guide.time}</em>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.toolsArea}>
          <div className={styles.shelfHeading}><div><h2>{t(K("tools.heading"))}</h2><p>{t(K("tools.subheading"))}</p></div></div>
          <div className={styles.documentToolCards}>
            {documentTools.map(({ title, detail, icon: Icon }) => (
              <div className={styles.documentToolCard} key={title}>
                <span><Icon size={20} aria-hidden="true" /></span>
                <strong>{t(title)}</strong>
                <small>{t(detail)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
