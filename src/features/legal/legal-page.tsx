import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { CookieSettingsButton } from "@/components/privacy/cookie-settings-button";
import { legalDocuments, type LegalDocument } from "./legal-documents";
import styles from "./legal-page.module.css";

export function LegalShell({ children, title = "Legal Center" }: { children: React.ReactNode; title?: string }) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.brandMark}><ShieldCheck size={17} /></span>EOS<span style={{ color: "#f51591" }}>.</span>studio</Link>
      <Link href="/" className={styles.backLink}><ArrowLeft size={14} /> กลับหน้าแรก</Link>
    </header>
    <main>{children}</main>
    <footer className={styles.footer}><small>© EOS Creative Studio · {title}</small><LegalLinks /></footer>
  </div>;
}

export function LegalLinks() {
  return <nav className={styles.footerLinks} aria-label="Legal links">
    {legalDocuments.map((document) => <Link key={document.slug} href={`/legal/${document.slug}`}>{document.shortTitle}</Link>)}
    <span className={styles.cookieSettingsButton}><CookieSettingsButton /></span>
  </nav>;
}

export function LegalHubPage() {
  return <LegalShell title="Legal Center"><div className={styles.container}>
    <div className={styles.hero}><div><p className={styles.eyebrow}>EOS Creative Studio</p><h1>Legal <span>Center</span></h1><p>เอกสารเกี่ยวกับความเป็นส่วนตัว การใช้บริการ คุกกี้ และการใช้งานสำหรับทีม</p></div><div className={styles.draft}><FileText size={14} /> ฉบับร่างสำหรับตรวจสอบ</div></div>
    <p className={styles.note}>เอกสารชุดนี้เป็นโครงร่างสำหรับนำไปตรวจสอบกับข้อมูลบริษัทและการทำงานจริงของระบบก่อนเผยแพร่ให้ผู้ใช้ยอมรับ</p>
    <div className={styles.hubGrid}>{legalDocuments.map((document) => <Link key={document.slug} href={`/legal/${document.slug}`} className={styles.hubCard}><strong>{document.title}</strong><span>{document.description}</span><small>อ่านเอกสาร <ArrowRight size={13} /></small></Link>)}</div>
  </div></LegalShell>;
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return <LegalShell title={document.shortTitle}><div className={styles.container}>
    <div className={styles.hero}><div><p className={styles.eyebrow}>EOS Creative Studio · Legal</p><h1>{document.title}</h1><p>{document.description}</p></div><div className={styles.draft}><FileText size={14} /> {document.effectiveDate}</div></div>
    {document.draftNote ? <p className={styles.note}>{document.draftNote}</p> : null}
    <div className={styles.layout}><nav className={styles.toc} aria-label="สารบัญเอกสาร"><p className={styles.tocTitle}>สารบัญ</p>{document.sections.map((section, index) => <a key={section.heading} href={`#section-${index + 1}`}>{section.heading}</a>)}</nav><article className={styles.article}><p className={styles.articleIntro}>เอกสารนี้เป็นฉบับร่างสำหรับ EOS Creative Studio กรุณาตรวจสอบกับฝ่ายกฎหมายและข้อมูลการให้บริการจริงก่อนนำไปใช้เป็นข้อตกลงหรือประกาศอย่างเป็นทางการ</p>{document.sections.map((section, index) => <section key={section.heading} id={`section-${index + 1}`} className={styles.section}><h2>{section.heading}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}</section>)}</article></div>
  </div></LegalShell>;
}
