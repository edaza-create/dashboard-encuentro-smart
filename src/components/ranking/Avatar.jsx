import { useEffect, useState } from "react";
import styles from "./Avatar.module.css";

/**
 * Avatar redondeado con iniciales o foto.
 *
 * Por defecto muestra las iniciales del `name` sobre un gradiente determinista
 * derivado del `seed` (asi el mismo asesor/BP siempre obtiene el mismo color).
 * Si pasas `src`, renderiza la foto; iniciales quedan como fallback automatico
 * si la imagen no carga (onError) o si no hay src.
 *
 * @param {{ name: string|null, src?: string|null, seed?: string|null, size?: number, dark?: boolean }} props
 */
export default function Avatar({ name, src, seed, size = 72, dark = false }) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset estado al cambiar src (cuando el ranking se refresca con fotos nuevas).
  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const initials = getInitials(name);
  const palette = getPalette(seed ?? name ?? "x", dark);
  const showImage = Boolean(src) && !imgFailed;

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    background: showImage
      ? "transparent"
      : `linear-gradient(155deg, ${palette.from} 0%, ${palette.to} 100%)`,
    fontSize: `${Math.round(size * 0.32)}px`
  };

  return (
    <div className={styles.avatar} style={style} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          className={styles.img}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={styles.initials} style={{ color: palette.fg }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function getInitials(name) {
  if (!name || typeof name !== "string") return "··";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Paleta deterministica por seed para que cada asesor/BP tenga su color estable.
const PALETTES_LIGHT = [
  { from: "#0B0F1A", to: "#1f2937", fg: "#CCFA3F" },
  { from: "#3B8EF5", to: "#2B7AE0", fg: "#FFFFFF" },
  { from: "#FF7A3D", to: "#e2521b", fg: "#FFFFFF" },
  { from: "#CCFA3F", to: "#9fc830", fg: "#0B0F1A" },
  { from: "#1a2030", to: "#0b0f1a", fg: "#CCFA3F" },
  { from: "#5BA4FF", to: "#3B8EF5", fg: "#0B0F1A" }
];

function getPalette(seed, dark) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % PALETTES_LIGHT.length;
  return dark ? { ...PALETTES_LIGHT[idx], fg: "#CCFA3F" } : PALETTES_LIGHT[idx];
}
