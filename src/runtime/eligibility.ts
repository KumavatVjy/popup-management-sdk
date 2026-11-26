import { PublicPopup } from '../client/types';

/**
 * Checks whether an individual popup is eligible based on its schedule window
 * relative to the provided comparison instant (in milliseconds since Unix epoch).
 *
 * Evaluation rules:
 * - null start_time and null end_time: eligible indefinitely.
 * - start_time provided: must be a parseable ISO date and start_time <= now (inclusive).
 * - end_time provided: must be a parseable ISO date and end_time >= now (inclusive).
 * - Both provided: start_time <= end_time, and start_time <= now <= end_time.
 * - Any unparseable timestamp or inverted range (start > end) excludes the popup.
 */
function isPopupScheduleEligible(popup: PublicPopup, nowMs: number): boolean {
  let startMs: number | null = null;
  let endMs: number | null = null;

  if (popup.start_time !== null) {
    startMs = Date.parse(popup.start_time);
    if (Number.isNaN(startMs)) {
      return false;
    }
  }

  if (popup.end_time !== null) {
    endMs = Date.parse(popup.end_time);
    if (Number.isNaN(endMs)) {
      return false;
    }
  }

  // If both timestamps are valid, verify start_time is not later than end_time
  if (startMs !== null && endMs !== null && startMs > endMs) {
    return false;
  }

  // If start_time is set, it must not be in the future (inclusive: startMs <= nowMs)
  if (startMs !== null && startMs > nowMs) {
    return false;
  }

  // If end_time is set, it must not be in the past (inclusive: endMs >= nowMs)
  if (endMs !== null && endMs < nowMs) {
    return false;
  }

  return true;
}

function normalizePath(path: string): string {
  const normalized = path.trim().split(/[?#]/, 1)[0] || '/';
  if (!normalized.startsWith('/')) return `/${normalized}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : '/';
}

function matchesPathRule(pathname: string, rule: string): boolean {
  const path = normalizePath(pathname);
  const pattern = normalizePath(rule);
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2).replace(/\/+$/, '');
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  return path === pattern;
}

function isPopupTargetedToPath(popup: PublicPopup, pathname: string): boolean {
  const targets = (popup.target_pages || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  const exclusions = (popup.exclude_pages || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  if (exclusions.some((rule) => matchesPathRule(pathname, rule))) return false;
  return targets.length === 0 || targets.includes('all') || targets.some((rule) => matchesPathRule(pathname, rule));
}

export type PopupDevice = 'desktop' | 'tablet' | 'mobile';

export function getPopupDevice(viewportWidth: number): PopupDevice {
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

function isPopupEnabledForCurrentDevice(popup: PublicPopup, viewportWidth: number): boolean {
  const device = getPopupDevice(viewportWidth);
  if (device === 'mobile') return popup.show_on_mobile !== false;
  if (device === 'tablet') return popup.show_on_tablet !== false;
  return popup.show_on_desktop !== false;
}

/**
 * Pure helper function that filters a list of public popups against the client-side
 * schedule window.
 *
 * Revalidates start_time and end_time against the provided comparison instant.
 * Does not filter by active status or soft-deletion (status filtering is handled
 * exclusively by the server delivery endpoint).
 *
 * @param popups The array of PublicPopup objects to filter.
 * @param now The comparison reference date (defaults to current time).
 * @returns A new array containing only eligible PublicPopup objects.
 */
export function filterEligiblePopups(
  popups: readonly PublicPopup[],
  now: Date = new Date(),
  pathname: string = typeof window === 'undefined' ? '/' : window.location.pathname
): PublicPopup[] {
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) {
    return [];
  }

  const eligible: PublicPopup[] = [];
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  for (const popup of popups) {
    if (
      isPopupScheduleEligible(popup, nowMs) &&
      isPopupTargetedToPath(popup, pathname) &&
      isPopupEnabledForCurrentDevice(popup, viewportWidth)
    ) {
      eligible.push(popup);
    }
  }

  return eligible;
}
