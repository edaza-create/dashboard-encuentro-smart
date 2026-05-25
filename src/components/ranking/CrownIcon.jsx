/**
 * Corona dorada (diseño imperial — 5 picos, gema central).
 * @param {{ className?: string, size?: number }} props
 */
export function GoldCrownIcon({ className = "", size = 52 }) {
  const height = Math.round(size * (34 / 48));

  return (
    <svg
      className={className}
      width={size}
      height={height}
      viewBox="0 0 48 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gc-body" x1="24" y1="4" x2="24" y2="32">
          <stop offset="0%" stopColor="#FFF9E6" />
          <stop offset="40%" stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
        <linearGradient id="gc-band" x1="24" y1="24" x2="24" y2="33">
          <stop offset="0%" stopColor="#E8C547" />
          <stop offset="100%" stopColor="#9A7B1A" />
        </linearGradient>
        <radialGradient id="gc-gem" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#FFFDE7" />
          <stop offset="55%" stopColor="#FFEB3B" />
          <stop offset="100%" stopColor="#F9A825" />
        </radialGradient>
      </defs>

      {/* cuerpo — 5 picos suaves */}
      <path
        d="M5 26.5
           L7.5 17 L10.5 26
           L13 15 L16 26
           L20 9 L24 6 L28 9
           L32 26 L35 15 L38 26
           L41.5 17 L43 26.5
           Z"
        fill="url(#gc-body)"
        stroke="#8B6914"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* banda inferior acolchada */}
      <path
        d="M6 26.5 H42 C42 29.5 38 32 24 32.5 C10 32 6 29.5 6 26.5 Z"
        fill="url(#gc-band)"
        stroke="#7A5F12"
        strokeWidth="0.9"
      />

      {/* perlas en la banda */}
      <circle cx="12" cy="28.5" r="1.4" fill="#FFF8E1" stroke="#8B6914" strokeWidth="0.5" />
      <circle cx="24" cy="29.2" r="1.6" fill="#FFF8E1" stroke="#8B6914" strokeWidth="0.5" />
      <circle cx="36" cy="28.5" r="1.4" fill="#FFF8E1" stroke="#8B6914" strokeWidth="0.5" />

      {/* gema central */}
      <path
        d="M24 5.5 L26.2 9.8 H21.8 Z"
        fill="url(#gc-gem)"
        stroke="#8B6914"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="7.2" r="1.1" fill="#FFFDE7" opacity="0.9" />
    </svg>
  );
}

export default function CrownIcon({ variant = "gold", className = "", size = 52 }) {
  if (variant === "gold") {
    return <GoldCrownIcon className={className} size={size} />;
  }
  return <GoldCrownIcon className={className} size={size} />;
}

/** Solo el primer puesto lleva corona. */
export function crownVariantForRank(index) {
  return index === 0 ? "gold" : null;
}
