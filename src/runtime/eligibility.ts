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
  now: Date = new Date()
): PublicPopup[] {
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) {
    return [];
  }

  const eligible: PublicPopup[] = [];
  for (const popup of popups) {
    if (isPopupScheduleEligible(popup, nowMs)) {
      eligible.push(popup);
    }
  }

  return eligible;
}
