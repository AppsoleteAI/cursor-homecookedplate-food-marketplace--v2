/**
 * Marketplace payout hold and platemaker removal rules.
 * Money amounts stay in fees.ts. This file is only the hold and the counts.
 */

export const PAYOUT_HOLD_DAYS = 7;
export const RESPONSIBILITY_WINDOW_DAYS = 30;

export const REMOVAL_THRESHOLDS = {
  chargeback: 3,
  refund: 5,
  complaint: 5,
  governmentRequest: 1,
} as const;

export type ResponsibilityKind = 'refund' | 'chargeback' | 'complaint' | 'government_request';

export type ResponsibilityCounts = {
  refund: number;
  chargeback: number;
  complaint: number;
  governmentRequest: number;
};

export const PLATEMAKER_RESPONSIBILITY_STATEMENT =
  'You take full responsibility for the food you sell. HomeCookedPlate pays your connected Stripe account directly, after a 7-day hold, so refunds and chargebacks can be fixed before that payout. Counts use a rolling 30-day window. Too many chargebacks, refunds, or complaints in that window removes your selling access. One government request for removal does the same. An admin restores selling. Message an admin from this screen.';

export function payoutReleaseAt(paidAt: Date = new Date()): string {
  const release = new Date(paidAt.getTime());
  release.setUTCDate(release.getUTCDate() + PAYOUT_HOLD_DAYS);
  return release.toISOString();
}

export function responsibilityWindowStart(now: Date = new Date()): string {
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - RESPONSIBILITY_WINDOW_DAYS);
  return start.toISOString();
}

export function removalReasons(counts: ResponsibilityCounts): string[] {
  const reasons: string[] = [];
  if (counts.governmentRequest >= REMOVAL_THRESHOLDS.governmentRequest) {
    reasons.push('A government request asked for this cook to be removed.');
  }
  if (counts.chargeback >= REMOVAL_THRESHOLDS.chargeback) {
    reasons.push(`${REMOVAL_THRESHOLDS.chargeback} chargebacks in ${RESPONSIBILITY_WINDOW_DAYS} days.`);
  }
  if (counts.refund >= REMOVAL_THRESHOLDS.refund) {
    reasons.push(`${REMOVAL_THRESHOLDS.refund} refunds in ${RESPONSIBILITY_WINDOW_DAYS} days.`);
  }
  if (counts.complaint >= REMOVAL_THRESHOLDS.complaint) {
    reasons.push(`${REMOVAL_THRESHOLDS.complaint} complaints in ${RESPONSIBILITY_WINDOW_DAYS} days.`);
  }
  return reasons;
}

function kindCount(kind: ResponsibilityKind, counts: ResponsibilityCounts): number {
  if (kind === 'chargeback') return counts.chargeback;
  if (kind === 'complaint') return counts.complaint;
  if (kind === 'government_request') return counts.governmentRequest;
  return counts.refund;
}

function kindLabel(kind: ResponsibilityKind): string {
  if (kind === 'chargeback') return 'Chargeback';
  if (kind === 'complaint') return 'Complaint';
  if (kind === 'government_request') return 'Government request';
  return 'Refund';
}

export function warningReasons(counts: ResponsibilityCounts): string[] {
  const warnings: string[] = [];
  const window = `rolling ${RESPONSIBILITY_WINDOW_DAYS} days`;
  if (counts.chargeback === REMOVAL_THRESHOLDS.chargeback - 1) {
    warnings.push(`${counts.chargeback} chargebacks in a ${window}. One more blocks new orders.`);
  }
  if (counts.refund === REMOVAL_THRESHOLDS.refund - 1) {
    warnings.push(`${counts.refund} refunds in a ${window}. One more blocks new orders.`);
  }
  if (counts.complaint === REMOVAL_THRESHOLDS.complaint - 1) {
    warnings.push(`${counts.complaint} complaints in a ${window}. One more blocks new orders.`);
  }
  return warnings;
}

export function eventNotice(
  kind: ResponsibilityKind,
  counts: ResponsibilityCounts,
  removed: boolean,
): { title: string; body: string } {
  const label = kindLabel(kind);
  const count = kindCount(kind, counts);
  if (removed) {
    return {
      title: `${label} recorded. New orders are blocked.`,
      body: `This ${label.toLowerCase()} is on your record. You have ${count} in the rolling ${RESPONSIBILITY_WINDOW_DAYS} days, and new orders are blocked. An admin can restore selling.`,
    };
  }
  return {
    title: `${label} recorded`,
    body: `This ${label.toLowerCase()} is on your record. You have ${count} in the rolling ${RESPONSIBILITY_WINDOW_DAYS} days.`,
  };
}

export function warningNotice(counts: ResponsibilityCounts): { title: string; body: string } | null {
  const reasons = warningReasons(counts);
  if (reasons.length === 0) return null;
  return {
    title: 'You are close to a selling block',
    body: reasons.join(' '),
  };
}
