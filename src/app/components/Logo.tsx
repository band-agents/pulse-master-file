/**
 * Al-Obour General Hospital mark.
 *
 * A rounded shield carrying a cross, with a pulse trace crossing its centre.
 * The two ideas the mark has to carry are "hospital" and "monitored" — the
 * cross says the first at any size, the trace says the second and is what
 * stops it looking like a pharmacy sign.
 *
 * Colours come from `--logo-ink` and `--logo-accent`, so the mark follows the
 * theme without the caller passing anything. Pass an explicit theme only when
 * the mark sits on a surface that is not the page background — a coloured
 * header, or a print sheet.
 */

import { BRAND } from "@/platform/lib/brand";

export type LogoTheme = "light" | "dark";
export type LogoVariant = "mark" | "wordmark" | "full";

interface LogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** Height of the mark in pixels; the wordmark scales from it. */
  size?: number;
  className?: string;
  /** Show the Arabic name under the English one. */
  bilingual?: boolean;
}

function inkFor(theme?: LogoTheme): string {
  if (theme === "light") return "#0B3D46";
  if (theme === "dark") return "#E8F4F6";
  return "var(--logo-ink)";
}

function accentFor(theme?: LogoTheme): string {
  if (theme === "light") return "#12817F";
  if (theme === "dark") return "#2FB6B0";
  return "var(--logo-accent)";
}

function ObourMark({ size, theme }: { size: number; theme?: LogoTheme }) {
  const ink = inkFor(theme);
  const accent = accentFor(theme);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={BRAND.name}
      className="shrink-0"
    >
      {/* Shield: a square with a softened lower edge, so it reads as a badge
          rather than an app tile. */}
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h19A2.5 2.5 0 0 1 28 6.5v11.9c0 3.6-2 6.9-5.2 8.6L16 30.5l-6.8-3.5A9.8 9.8 0 0 1 4 18.4V6.5Z"
        fill={accent}
      />
      {/* The cross, cut as negative space out of the shield. */}
      <path
        d="M13.6 8.4h4.8v4.2h4.2v4.8h-4.2v4.2h-4.8v-4.2H9.4v-4.8h4.2V8.4Z"
        fill="var(--card, #fff)"
        opacity="0.96"
      />
      {/* Pulse trace across the waist of the mark, drawn over the cross so the
          two read as one object rather than a badge with a sticker on it. */}
      <path
        d="M2.5 15h5.2l2-3.6 2.9 7.4 2.6-5.3 1.9 3.1h1.6"
        stroke={ink}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function Wordmark({
  size, theme, bilingual, className = "",
}: { size: number; theme?: LogoTheme; bilingual?: boolean; className?: string }) {
  const ink = inkFor(theme);
  return (
    <span className={`inline-flex flex-col leading-none ${className}`}>
      <span
        style={{
          fontFamily: "var(--app-font-display)",
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: ink,
        }}
      >
        Al-Obour
        <span style={{ opacity: 0.62, fontWeight: 500 }}> General Hospital</span>
      </span>
      {bilingual && (
        <span
          dir="rtl"
          style={{
            fontFamily: "var(--app-font-display)",
            fontSize: size * 0.78,
            fontWeight: 500,
            color: ink,
            opacity: 0.7,
            marginTop: size * 0.18,
          }}
        >
          {BRAND.nameAr}
        </span>
      )}
    </span>
  );
}

function _Logo({ variant = "mark", theme, size = 20, className = "", bilingual }: LogoProps) {
  if (variant === "mark") return <ObourMark size={size} theme={theme} />;
  if (variant === "wordmark") {
    return <Wordmark size={size} theme={theme} bilingual={bilingual} className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ObourMark size={size * 1.35} theme={theme} />
      <Wordmark size={size} theme={theme} bilingual={bilingual} />
    </span>
  );
}

export const Logo = _Logo;
export default _Logo;
