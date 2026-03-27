import {
  SYSTEM_SERIES,
  ARCHITECTURE_SERIES,
  PHYSICS_SERIES,
  ATMOSPHERE_SERIES,
  MINIMALIST_SERIES,
} from '@/constants/WorkoutNames';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function titleCase(raw: string): string {
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function normalizeLabel(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Session';
  if (cleaned === 'Push, Pull, Legs') return 'Push';
  return titleCase(cleaned);
}

function getTag(style: string, split: string, metconFormat?: string | null): string {
  const styleLower = style.toLowerCase();
  if (styleLower === 'crossfit') {
    return normalizeLabel(metconFormat || split || 'WOD');
  }
  return normalizeLabel(split || style || 'Session');
}

/** Parses "Cantilever (Push)" → "Cantilever". Returns null if not in that shape. */
export function extractCreativeNameFromTitle(fullTitle: string): string | null {
  const t = fullTitle.trim();
  if (!t || t === 'Rest Day') return null;
  const open = t.lastIndexOf(' (');
  if (open <= 0) return null;
  return t.slice(0, open).trim();
}

/**
 * Random pick from series. If `avoid` matches a name exactly, it is excluded
 * so you do not get the same creative name twice in a row.
 */
function pickRandomCreative(series: string[], avoid: string | null): string {
  if (series.length === 0) return '';
  let pool = avoid ? series.filter((n) => n !== avoid) : series;
  if (pool.length === 0) pool = series;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Series selector ─────────────────────────────────────────────────────────

/**
 * Picks the right themed name series based on workout style, format, and duration.
 */
function selectSeries(
  style: string,
  metconFormat: string | null | undefined,
  duration?: number,
): string[] {
  if (duration !== undefined && duration < 15) {
    return MINIMALIST_SERIES;
  }

  const s = style.toLowerCase();
  const fmt = (metconFormat ?? '').toLowerCase();

  if (s === 'strength' || s === 'bodybuilding') {
    return ARCHITECTURE_SERIES;
  }

  if (
    s === 'hiit' ||
    fmt === 'amrap' ||
    fmt === 'chipper' ||
    fmt === 'ladder' ||
    (s === 'crossfit' && (fmt === 'amrap' || fmt === 'chipper' || fmt === 'ladder'))
  ) {
    return PHYSICS_SERIES;
  }

  if (s === 'mobility' || s === 'pilates' || s === 'low-impact') {
    return ATMOSPHERE_SERIES;
  }

  return SYSTEM_SERIES;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns a themed workout title: "Cantilever (Push)".
 * The creative name is chosen at random from the routed series.
 * Pass `previousTitle` (full string) to avoid repeating the same creative name
 * back-to-back when style/split/format are unchanged.
 */
export function buildCreativeWorkoutTitle(args: {
  style: string;
  split: string;
  metconFormat?: string | null;
  duration?: number;
  /** Full previous title, e.g. "Cantilever (Push)" — creative part is excluded from the pool */
  previousTitle?: string | null;
}): string {
  const { style, split, metconFormat, duration, previousTitle } = args;

  const series = selectSeries(style, metconFormat, duration);
  const avoid = previousTitle ? extractCreativeNameFromTitle(previousTitle) : null;
  const name = pickRandomCreative(series, avoid);
  const tag = getTag(style, split, metconFormat);

  return `${name} (${tag})`;
}
