"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { EosLogo } from "@/components/brand/eos-logo";
import { useLocale } from "@/lib/i18n/locale-provider";
import { legalDocuments, type LegalDocument } from "./legal-documents";
import styles from "./legal-page.module.css";

export function LegalShell({ children, title = "Legal Center" }: { children: React.ReactNode; title?: string }) {
  return <div className={styles.page} data-page="legal">
    <header className={styles.header}>
      <EosLogo href="/" />
      <Link href="/" className={styles.backLink}><ArrowLeft size={14} /> กลับหน้าแรก</Link>
    </header>
    <main>{children}</main>
    <footer className={styles.footer}><small>© EOS Creative Studio · {title}</small></footer>
  </div>;
}

export function LegalHubPage() {
  return <LegalShell title="Legal Center"><div className={styles.container}>
    <div className={styles.hero}><div><p className={styles.eyebrow}>EOS Creative Studio</p><h1>Legal <span>Center</span></h1><p>เอกสารเกี่ยวกับความเป็นส่วนตัว การใช้บริการ คุกกี้ และการใช้งานสำหรับทีม</p></div><div className={styles.draft}><FileText size={14} /> ฉบับร่างสำหรับตรวจสอบ</div></div>
    <p className={styles.note}>เอกสารชุดนี้เป็นโครงร่างสำหรับนำไปตรวจสอบกับข้อมูลบริษัทและการทำงานจริงของระบบก่อนเผยแพร่ให้ผู้ใช้ยอมรับ</p>
    <div className={styles.hubGrid}>{legalDocuments.map((document) => <Link key={document.slug} href={`/legal/${document.slug}`} className={styles.hubCard}><strong>{document.title}</strong><span>{document.description}</span><small>อ่านเอกสาร <ArrowRight size={13} /></small></Link>)}</div>
  </div></LegalShell>;
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const { locale, setLocale, persistLocale } = useLocale();
  const content = document.translations?.[locale] ?? document;
  const isEnglish = locale === "en";
  const intro = document.slug === "terms-of-use"
    ? isEnglish
      ? "These Terms of Service for EOS Creative Studio are effective from October 15, 2026."
      : "ข้อกำหนดและเงื่อนไขการใช้บริการของ EOS Creative Studio มีผลบังคับใช้ตั้งแต่วันที่ 15 ตุลาคม 2026"
    : isEnglish
      ? "This document is a draft for EOS Creative Studio. Please review it against the company’s legal requirements and actual service behavior before publishing."
      : "เอกสารนี้เป็นฉบับร่างสำหรับ EOS Creative Studio กรุณาตรวจสอบกับฝ่ายกฎหมายและข้อมูลการให้บริการจริงก่อนนำไปใช้เป็นข้อตกลงหรือประกาศอย่างเป็นทางการ";
  const changeLocale = (nextLocale: "th" | "en") => {
    setLocale(nextLocale);
    persistLocale(nextLocale);
  };

  return <LegalShell title={content.shortTitle}><div className={styles.container}>
    <div className={styles.hero}><div><p className={styles.eyebrow}>EOS Creative Studio · Legal</p><h1>{content.title}</h1><p>{content.description}</p></div><div className={styles.heroActions}><div className={styles.languageSwitch} role="group" aria-label={isEnglish ? "Document language" : "ภาษาของเอกสาร"}><button type="button" onClick={() => changeLocale("th")} aria-pressed={locale === "th"} className={locale === "th" ? styles.languageActive : ""}>ไทย</button><button type="button" onClick={() => changeLocale("en")} aria-pressed={locale === "en"} className={locale === "en" ? styles.languageActive : ""}>English</button></div><div className={styles.draft}><FileText size={14} /> {content.effectiveDate}</div></div></div>
    {content.draftNote ? <p className={styles.note}>{content.draftNote}</p> : null}
    <div className={styles.layout}><nav className={styles.toc} aria-label={isEnglish ? "Document contents" : "สารบัญเอกสาร"}><p className={styles.tocTitle}>{isEnglish ? "Contents" : "สารบัญ"}</p>{content.sections.map((section, index) => <a key={section.heading} href={`#section-${index + 1}`}>{section.heading}</a>)}</nav><article className={styles.article}><p className={styles.articleIntro}>{intro}</p>{content.sections.map((section, index) => <section key={section.heading} id={`section-${index + 1}`} className={styles.section}><h2>{section.heading}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}</section>)}</article></div>
  </div></LegalShell>;
}
