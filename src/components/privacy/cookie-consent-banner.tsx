"use client";

import Link from "next/link";
import { Check, Cookie, Settings2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const COOKIE_NAME = "eos_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 180;
const CONSENT_EVENT = "eos:cookie-consent";
const OPEN_SETTINGS_EVENT = "eos:open-cookie-settings";

type Consent = { necessary: true; analytics: boolean; marketing: boolean };

function readConsentCookieValue(): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  return entry ? entry.slice(COOKIE_NAME.length + 1) : null;
}

function parseConsent(rawValue: string | null): Consent | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<Consent>;
    return { necessary: true, analytics: parsed.analytics === true, marketing: parsed.marketing === true };
  } catch {
    return null;
  }
}

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onStoreChange);
  return () => window.removeEventListener(CONSENT_EVENT, onStoreChange);
}

function getServerConsent() {
  return null;
}

function saveConsent(value: Consent) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function CookieConsentBanner() {
  const rawConsent = useSyncExternalStore(subscribeToConsent, readConsentCookieValue, getServerConsent);
  const consent = parseConsent(rawConsent);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const openSettings = () => {
      const current = parseConsent(readConsentCookieValue());
      setAnalytics(current?.analytics === true);
      setMarketing(current?.marketing === true);
      setCustomize(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  if (consent && !customize) return null;

  const acceptAll = () => { saveConsent({ necessary: true, analytics: true, marketing: true }); setCustomize(false); };
  const rejectAll = () => { saveConsent({ necessary: true, analytics: false, marketing: false }); setCustomize(false); };
  const savePreferences = () => { saveConsent({ necessary: true, analytics, marketing }); setCustomize(false); };

  return <aside className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-3xl rounded-2xl border border-[#eaded6] bg-white p-4 shadow-[0_18px_60px_rgba(47,29,20,0.2)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:left-6 sm:p-5" aria-label="Cookie consent" role="dialog">
    <div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0e9] text-[#f15b20]"><Cookie size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-[#242125]">เราใช้คุกกี้</h2><p className="mt-1 text-xs leading-5 text-[#716a70]">คุกกี้ที่จำเป็นช่วยให้ระบบทำงาน ส่วนคุกกี้ analytics และ marketing จะเปิดใช้ตามตัวเลือกของคุณ</p></div><button type="button" className="rounded-lg p-1 text-[#8c858a] hover:bg-[#fff4ef]" onClick={rejectAll} aria-label="ปิดและปฏิเสธคุกกี้ที่ไม่จำเป็น"><X size={16} /></button></div>{customize ? <div className="mt-3 grid gap-2 rounded-xl border border-[#eee6e1] bg-[#fcfaf8] p-3 text-xs text-[#514b51]"><label className="flex items-center gap-2"><input type="checkbox" checked disabled className="accent-[#f15b20]" /><span><strong>จำเป็น</strong><small className="ml-1 text-[#8c858a]">ระบบจะทำงานไม่ได้หากปิด</small></span></label><label className="flex items-center gap-2"><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="accent-[#f15b20]" /><span><strong>Analytics</strong><small className="ml-1 text-[#8c858a]">วัดการใช้งานเพื่อปรับปรุงบริการ</small></span></label><label className="flex items-center gap-2"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="accent-[#f15b20]" /><span><strong>Marketing</strong><small className="ml-1 text-[#8c858a]">การตลาดและโฆษณาที่ปรับตามความสนใจ</small></span></label></div> : null}<div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={acceptAll} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#f15b20] px-3.5 text-xs font-bold text-white hover:bg-[#dd5418]"><Check size={14} /> ยอมรับทั้งหมด</button><button type="button" onClick={rejectAll} className="inline-flex min-h-9 items-center rounded-lg border border-[#eaded6] px-3.5 text-xs font-bold text-[#615b61] hover:bg-[#fff8f4]">ปฏิเสธทั้งหมด</button>{customize ? <button type="button" onClick={savePreferences} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#f5a27e] px-3.5 text-xs font-bold text-[#c64f1f] hover:bg-[#fff4ef]"><Settings2 size={14} /> บันทึกการตั้งค่า</button> : <button type="button" onClick={() => setCustomize(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#8a5a44] hover:bg-[#fff8f4]"><Settings2 size={14} /> ปรับแต่ง</button>}<Link href="/legal/cookies" className="ml-auto text-[11px] font-semibold text-[#8a858a] underline underline-offset-2">อ่านนโยบายคุกกี้</Link></div></div></div>
  </aside>;
}
