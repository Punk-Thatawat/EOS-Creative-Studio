/** Small drawings for the affiliate page. Plain SVG, so they need no files and scale with the layout. */

/** The megaphone in the banner: white on the orange, with a few sparks flying off it. */
export function MegaphoneArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 260 210" fill="none" aria-hidden="true" focusable="false">
      <circle cx="150" cy="108" r="88" fill="#fff" fillOpacity="0.13" />
      <circle cx="150" cy="108" r="60" fill="#fff" fillOpacity="0.12" />
      {/* sparks */}
      <path d="M42 66l22 14" stroke="#ffd86b" strokeWidth="8" strokeLinecap="round" />
      <path d="M34 104h28" stroke="#ffd86b" strokeWidth="8" strokeLinecap="round" />
      <path d="M54 142l22-12" stroke="#ffd86b" strokeWidth="8" strokeLinecap="round" />
      <circle cx="198" cy="26" r="5" fill="#fff" fillOpacity="0.8" />
      <circle cx="226" cy="150" r="4" fill="#fff" fillOpacity="0.7" />
      <g transform="rotate(-16 150 108)">
        {/* handle */}
        <path d="M100 132l14 44c2 7-2 12-9 12h-9c-7 0-10-5-9-11l5-45z" fill="#ff8a52" />
        {/* horn */}
        <path d="M84 84l78-38c14-7 28 1 28 17v90c0 16-14 24-28 17l-78-38z" fill="#fff" />
        <path d="M84 84l78-38c14-7 28 1 28 17v14l-106 20z" fill="#ffe9df" />
        {/* the back of the horn */}
        <rect x="58" y="80" width="34" height="54" rx="12" fill="#ff8a52" />
        <rect x="70" y="92" width="10" height="30" rx="5" fill="#ffb893" />
        {/* the open end */}
        <ellipse cx="188" cy="108" rx="15" ry="52" fill="#ffd3bd" />
        <ellipse cx="188" cy="108" rx="9" ry="42" fill="#f26b38" />
      </g>
    </svg>
  );
}

/** A report with a magnifier: shown where the chart has nothing to draw yet. */
export function EmptyChartArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 150" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="112" cy="128" rx="96" ry="14" fill="#fdeee6" />
      <ellipse cx="64" cy="104" rx="52" ry="26" fill="#fdeee6" />
      <rect x="64" y="14" width="88" height="108" rx="12" fill="#e9eaf2" />
      <rect x="64" y="14" width="88" height="108" rx="12" stroke="#cfd2e3" strokeWidth="2" />
      <rect x="78" y="32" width="46" height="7" rx="3.5" fill="#bfc4dc" />
      <rect x="78" y="48" width="60" height="7" rx="3.5" fill="#cfd3e6" />
      <rect x="78" y="64" width="34" height="7" rx="3.5" fill="#cfd3e6" />
      <rect x="78" y="86" width="9" height="22" rx="2" fill="#bfc4dc" />
      <rect x="92" y="78" width="9" height="30" rx="2" fill="#bfc4dc" />
      <rect x="106" y="92" width="9" height="16" rx="2" fill="#bfc4dc" />
      {/* magnifier */}
      <circle cx="140" cy="96" r="24" fill="#fff" fillOpacity="0.7" stroke="#f59a3d" strokeWidth="8" />
      <path d="M158 114l20 22" stroke="#f59a3d" strokeWidth="10" strokeLinecap="round" />
      <path d="M130 90a14 14 0 0 1 12-8" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
