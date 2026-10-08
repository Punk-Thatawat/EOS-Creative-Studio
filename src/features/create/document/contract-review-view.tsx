"use client";

import { AlertTriangle, Lightbulb, Quote, ShieldCheck } from "lucide-react";
import type { ContractReview, ContractSeverity } from "@/lib/api/document-contract";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./contract-review-view.module.css";

const K = (key: string) => `create.document.${key}` as TranslationKey;
const SEVERITIES: readonly ContractSeverity[] = ["high", "medium", "low"];

/** What the AI found in a contract: a short summary, the key facts, and the clauses to watch, most serious first. */
export function ContractReviewView({ review, fileName, creditsUsed }: { review: ContractReview; fileName: string; creditsUsed: number }) {
  const { t } = useLocale();
  const counts = SEVERITIES.map((severity) => ({ severity, count: review.risks.filter((risk) => risk.severity === severity).length }));

  return (
    <div className={styles.view}>
      <header className={styles.head}>
        <div className={styles.headText}>
          {review.contractType && <span className={styles.badge}>{review.contractType}</span>}
          <h3>{review.title}</h3>
          <small>{fileName} · {t(K("contract.view.credits"), { n: creditsUsed })}</small>
        </div>
      </header>

      {review.summary && (
        <section className={styles.card}>
          <h4>{t(K("contract.view.summary"))}</h4>
          <p className={styles.summary}>{review.summary}</p>
        </section>
      )}

      {review.keyFacts.length > 0 && (
        <section className={styles.card}>
          <h4>{t(K("contract.view.facts"))}</h4>
          <dl className={styles.facts}>
            {review.keyFacts.map((fact, index) => (
              <div key={`${index}-${fact.label}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.risksHead}>
          <h4>{t(K("contract.view.risks"))}</h4>
          {review.risks.length > 0 && (
            <span className={styles.counts}>
              {counts.filter((entry) => entry.count > 0).map((entry) => (
                <span key={entry.severity} className={`${styles.pill} ${styles[entry.severity]}`}>{t(K(`contract.severity.${entry.severity}`))} {entry.count}</span>
              ))}
            </span>
          )}
        </div>
        {review.risks.length === 0 ? (
          <p className={styles.none}><ShieldCheck size={16} aria-hidden="true" />{t(K("contract.view.noRisks"))}</p>
        ) : (
          <ol className={styles.risks}>
            {review.risks.map((risk, index) => (
              <li key={`${index}-${risk.title}`} className={`${styles.risk} ${styles[`risk_${risk.severity}`]}`}>
                <div className={styles.riskTitle}>
                  <span className={`${styles.pill} ${styles[risk.severity]}`}><AlertTriangle size={12} aria-hidden="true" />{t(K(`contract.severity.${risk.severity}`))}</span>
                  <strong>{risk.title}</strong>
                </div>
                {risk.clause && (
                  <blockquote><Quote size={13} aria-hidden="true" /><span><em>{t(K("contract.view.clause"))}</em>{risk.clause}</span></blockquote>
                )}
                <p>{risk.explanation}</p>
                {risk.suggestion && <p className={styles.suggestion}><Lightbulb size={14} aria-hidden="true" /><span><em>{t(K("contract.view.suggestion"))}</em>{risk.suggestion}</span></p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className={styles.disclaimer} role="note">{t(K("contract.disclaimer"))}</p>
    </div>
  );
}
