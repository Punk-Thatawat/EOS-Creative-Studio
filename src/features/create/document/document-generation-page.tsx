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
import { useState } from "react";
import { CreatorWorkspaceLayout } from "@/components/create/creator-workspace-layout";
import styles from "./document-generation-page.module.css";

const modes = [
  { label: "OCR & Extract", icon: ScanText },
  { label: "Summarize", icon: NotebookPen },
  { label: "Translate", icon: Languages },
  { label: "Contract Review", icon: FileCheck2 },
  { label: "Report Builder", icon: BarChart3 },
  { label: "Form Reader", icon: ListChecks },
];

const outputs = [
  { label: "Summary", icon: NotebookPen },
  { label: "Key fields", icon: ListChecks },
  { label: "Extracted table", icon: Table2 },
  { label: "Translated version", icon: Languages },
  { label: "AI notes", icon: Sparkles },
];

const guides = [
  { title: "OCR quick start", detail: "Extract text in minutes", time: "03:21", tone: "orange" },
  { title: "Contract review", detail: "Find risks instantly", time: "04:35", tone: "pink" },
  { title: "Prompt like a pro", detail: "Get better results", time: "05:12", tone: "yellow" },
  { title: "Build reports fast", detail: "Turn data into insight", time: "06:08", tone: "blue" },
];

const documentTools = [
  { title: "OCR Extractor", detail: "Extract text and data", icon: ScanText },
  { title: "Contract Analyzer", detail: "Review clauses and risks", icon: FileCheck2 },
  { title: "Meeting Notes", detail: "Transcribe and summarize", icon: NotebookPen },
  { title: "Report Builder", detail: "Create reports from data", icon: BarChart3 },
];

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
  const [activeMode, setActiveMode] = useState("OCR & Extract");
  const [summaryStyle, setSummaryStyle] = useState("Executive brief");
  const isSummarize = activeMode === "Summarize";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>EOS CREATIVE STUDIO</span>
          <h1>GEN DOCUMENT</h1>
          <div className={styles.heroStamp}>AI DOCUMENT GENERATION STUDIO</div>
          <p>Turn files into insight.</p>
        </div>
        <div className={styles.heroArtwork} aria-hidden="true">
          <div className={styles.heroBrush}>TURN FILES<br />INTO INSIGHT.</div>
          <div className={`${styles.paper} ${styles.paperBack}`}>
            <span>Q2 BUSINESS REPORT</span>
            <i /><i /><i />
            <div className={styles.miniChart}><b /><b /><b /><b /><b /></div>
          </div>
          <div className={styles.smartSticker}>MAKE<br />IT SMART.</div>
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
          <nav className={styles.modeTabs} aria-label="Document tools">
            {modes.map(({ label, icon: Icon }) => {
              const isAvailable = label === "OCR & Extract" || label === "Summarize";
              const isActive = activeMode === label;
              return (
              <button
                key={label}
                type="button"
                className={`${styles.modeTab} ${isActive ? styles.modeTabActive : ""} ${!isAvailable ? styles.modeTabDisabled : ""}`}
                aria-pressed={isActive}
                aria-disabled={!isAvailable}
                title={isAvailable ? label : `${label} — coming soon`}
                onClick={() => isAvailable && setActiveMode(label)}
              >
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </button>
              );
            })}
          </nav>
        }
        left={
          <aside className={styles.sourcePanel} aria-label="Document source and instructions">
          <PanelHeading step="1" >SOURCE</PanelHeading>
          <div className={styles.dropzone}>
            <CloudUpload size={29} strokeWidth={1.7} aria-hidden="true" />
            <strong>Drop files here</strong>
            <span>or click to upload</span>
            <small>PDF, DOCX, PNG, JPG · Max 50 MB</small>
          </div>
          <div className={styles.filePlaceholder}>
            <span className={styles.fileIcon}><FileText size={17} aria-hidden="true" /></span>
            <span className={styles.fileCopy}><strong>Your files will appear here</strong><small>Upload a document to begin</small></span>
            <Plus size={16} aria-hidden="true" />
          </div>
          <SelectPlaceholder label="Pages" value="All pages" />
          <div className={styles.sectionRule} />
          <PanelHeading step="2">{isSummarize ? "SUMMARY GOAL" : "INSTRUCTIONS"}</PanelHeading>
          {isSummarize ? (
            <>
              <div className={styles.summaryPrompt}>
                <textarea aria-label="Summary instructions" maxLength={600} placeholder="Example: Summarize the main findings, decisions, and action items…" />
                <small>0 / 600</small>
              </div>
              <div className={styles.summaryFormatGroup}>
                <span>Summary format</span>
                <div className={styles.summaryFormatChoices}>
                  {["Executive brief", "Bullet points"].map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={summaryStyle === style ? styles.summaryFormatActive : ""}
                      aria-pressed={summaryStyle === style}
                      onClick={() => setSummaryStyle(style)}
                    >
                      {style === "Executive brief" ? <NotebookPen size={14} aria-hidden="true" /> : <ListChecks size={14} aria-hidden="true" />}
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.instructionPlaceholder}>
              <span>Describe what you want to find or create…</span>
              <small>0 / 600</small>
            </div>
          )}
          <div className={styles.checkList}>
            {isSummarize ? (
              <>
                <div><i className={styles.checkedBox} />Include key takeaways</div>
                <div><i className={styles.checkedBox} />Highlight action items</div>
                <div><i className={styles.checkedBox} />Keep important dates</div>
              </>
            ) : (
              <>
                <div><i className={styles.checkedBox} />Extract tables</div>
                <div><i className={styles.checkedBox} />Detect handwriting</div>
                <div><i className={styles.checkedBox} />Preserve document layout</div>
              </>
            )}
          </div>
          </aside>
        }
        preview={
          <main className={styles.previewPanel} aria-label="Document preview">
          <div className={styles.previewHeader}>
            <div><span>PREVIEW</span><small>{isSummarize ? "Summary workspace" : "Document canvas"}</small></div>
            <div className={styles.previewToolbar} aria-label="Preview controls">
              <ZoomIn size={14} aria-hidden="true" />
              <ZoomOut size={14} aria-hidden="true" />
              <span>100% <ChevronDown size={12} /></span>
              <Hand size={14} aria-hidden="true" />
              <span className={styles.toolbarDivider} />
              <span>Compare</span>
              <span>Annotate</span>
              <span><Download size={13} />Export</span>
            </div>
          </div>

          <div className={`${styles.previewStage} ${isSummarize ? styles.previewStageSummary : ""}`}>
            {isSummarize ? (
              <div className={styles.summaryStage}>
                <article className={styles.summaryDocument}>
                  <div className={styles.summaryDocumentTopline}>
                    <span className={styles.sampleBadge}>SAMPLE OUTPUT</span>
                    <span>Q2 Business Report · 8 pages</span>
                  </div>
                  <div className={styles.summaryDocumentHeading}>
                    <small>{summaryStyle.toUpperCase()}</small>
                    <h3>Q2 Business Report</h3>
                    <p>Revenue reached <strong>$8.42M</strong>, growing 18.6% quarter over quarter as product adoption and strategic partnerships expanded.</p>
                  </div>
                  <div className={styles.summaryMetric}>
                    <span><small>Total revenue</small><strong>$8.42M</strong><em>+18.6% vs Q1</em></span>
                    <span><small>Net profit</small><strong>$1.68M</strong><em>+34.4% vs Q1</em></span>
                    <span><small>Gross profit</small><strong>$3.92M</strong><em>+22.1% vs Q1</em></span>
                  </div>
                  <div className={styles.summaryTakeaways}>
                    <h4>Key takeaways</h4>
                    <ul>
                      <li>Product adoption was the strongest driver of revenue growth.</li>
                      <li>Net profit grew faster than revenue, improving overall margins.</li>
                    </ul>
                  </div>
                  <div className={styles.summaryDocumentFooter}>Example only · Upload a document to generate your own summary</div>
                </article>
              </div>
            ) : (
              <>
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
                    <div className={styles.sheetTopline}><span /><span>DOCUMENT PREVIEW</span></div>
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
                    <strong>Your document preview will appear here</strong>
                    <small>Upload a file to see pages, annotations, and extracted content</small>
                  </div>
                  <div className={styles.canvasPageNumber}>Page 1 of 1</div>
                </div>
              </>
            )}
          </div>

          {isSummarize ? (
            <div className={styles.summaryOutputCards}>
              <article><div><NotebookPen size={13} /><strong>Executive summary</strong></div><p>Q2 revenue increased 18.6% to $8.42M, led by product adoption and strategic partnerships.</p></article>
              <article><div><ListChecks size={13} /><strong>Key takeaways</strong></div><p>Profit grew faster than revenue and margins improved across key segments.</p></article>
              <article><div><Sparkles size={13} /><strong>Suggested next steps</strong></div><p>Monitor operating costs and continue investment in top-performing segments.</p></article>
            </div>
          ) : (
            <div className={styles.outputCards}>
              {outputs.map(({ label, icon: Icon }) => (
                <div className={styles.outputCard} key={label}>
                  <div className={styles.outputTitle}><Icon size={13} aria-hidden="true" /><strong>{label}</strong></div>
                  <i /><i /><i />
                  <small>Results appear after processing</small>
                </div>
              ))}
            </div>
          )}
          </main>
        }
        right={
          <aside className={styles.settingsPanel} aria-label="Document settings">
          <PanelHeading step="3">SETTINGS</PanelHeading>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>Model <span>ⓘ</span></div>
            <div className={styles.modelCards}>
              <div className={`${styles.modelCard} ${styles.modelCardActive}`}><i /><strong>Standard</strong><small>Balanced speed &amp; accuracy</small></div>
              <div className={styles.modelCard}><i /><strong>Premium</strong><small>Higher accuracy for complex docs</small></div>
            </div>
          </div>
          <div className={styles.settingGroup}>
            <div className={styles.settingLabel}>Output format</div>
            <div className={styles.formatCards}>
              {["DOCX", "PDF", "TXT", "JSON"].map((format, index) => (
                <div key={format} className={`${styles.formatCard} ${index === 0 ? styles.formatCardActive : ""}`}>
                  <FileText size={18} aria-hidden="true" /><span>{format}</span>
                </div>
              ))}
            </div>
          </div>
          <SelectPlaceholder label="Language" value="English (US)" />
          {isSummarize ? (
            <>
              <SelectPlaceholder label="Summary length" value="Standard · 1–2 pages" />
              <SelectPlaceholder label="Focus areas" value="Takeaways, decisions, actions" />
              <SelectPlaceholder label="Tone / Style" value="Executive & concise" />
            </>
          ) : (
            <>
              <SelectPlaceholder label="Page range" value="All pages" />
              <SelectPlaceholder label="Extraction depth" value="Advanced (Tables, Forms, Notes)" />
              <SelectPlaceholder label="Tone / Style" value="Professional & Clear" />
            </>
          )}
          <div className={styles.estimate}><span>Estimated credits</span><strong>— Credits</strong></div>
          <button className={styles.generateButton} type="button" disabled>
            <span>{isSummarize ? "GENERATE SUMMARY" : "GENERATE DOCUMENT"}</span>
            <Sparkles size={17} aria-hidden="true" />
          </button>
          <div className={styles.secureNote}><span />Your documents stay private and secure</div>
          </aside>
        }
      />

      <section className={styles.resourceShelf} aria-label="Document learning and tools">
        <div className={styles.learnArea}>
          <div className={styles.shelfHeading}>
            <div><h2>LEARN &amp; MASTER DOCUMENT AI</h2><p>Short guides to get more from your documents</p></div>
            <a href="#document-guides">View all <ArrowUpRight size={13} aria-hidden="true" /></a>
          </div>
          <div className={styles.guideCards} id="document-guides">
            {guides.map((guide) => (
              <div className={styles.guideCard} key={guide.title}>
                <div className={`${styles.guideThumb} ${styles[`guideTone_${guide.tone}`]}`}>
                  <span>{guide.title}</span><Play size={14} fill="currentColor" aria-hidden="true" />
                </div>
                <strong>{guide.title}</strong>
                <small>{guide.detail}</small>
                <em>{guide.time}</em>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.toolsArea}>
          <div className={styles.shelfHeading}><div><h2>POWERFUL DOCUMENT TOOLS</h2><p>More ways to work with files</p></div></div>
          <div className={styles.documentToolCards}>
            {documentTools.map(({ title, detail, icon: Icon }) => (
              <div className={styles.documentToolCard} key={title}>
                <span><Icon size={20} aria-hidden="true" /></span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
