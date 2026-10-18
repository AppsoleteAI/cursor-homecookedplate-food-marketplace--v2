/**
 * Marketplace payout hold and platemaker removal rules.
 * Money amounts stay in fees.ts. This file is only the hold and the counts.
 */
import { salesVolumeCap } from './fees';

export const PAYOUT_HOLD_DAYS = 7;
export const RESPONSIBILITY_WINDOW_DAYS = 30;
export const SALES_WEEK_DAYS = 7;

/** Four lost disputes in a rolling 12 months, one per quarter. Two inside 60 days move the ban to the third. */
export const LOST_DISPUTE_BAN_COUNT = 4;
export const LOST_DISPUTE_WINDOW_MONTHS = 12;
export const LOST_DISPUTE_ACCELERATE_COUNT = 2;
export const LOST_DISPUTE_ACCELERATE_BAN_COUNT = 3;
export const LOST_DISPUTE_ACCELERATE_DAYS = 60;
export const SUPPORT_EMAIL = 'support@homecookedplate.com';

export const PLATEMAKER_LOST_DISPUTE_SIGNUP =
  'A lost card dispute is charged to you. If a PlateTaker\'s bank pulls a payment back and the dispute is lost, you pay $15. HomeCookedPlate does not pay that fee. It is taken from your Stripe balance, or from your next payout when the balance cannot cover it. Write to support@homecookedplate.com about that dispute. If you block that PlateTaker from ordering your plates, half of the $15 fee ($7.50) is returned.';

export const PLATETAKER_LOST_DISPUTE_SIGNUP =
  'A lost card dispute counts on your account. 4 lost disputes in a rolling 12 months, one per quarter, permanently ban you from HomeCookedPlate. If 2 lost disputes happen within 60 days, that ban happens on the 3rd. Each lost dispute charges the cook a $15 fee. Write to support@homecookedplate.com to discuss a lost dispute.';

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
  'You take full responsibility for the food you sell. HomeCookedPlate pays your connected Stripe account directly, after a 7-day hold, so refunds and chargebacks can be fixed before that payout. A lost card dispute is a $15 fee charged to you, not to HomeCookedPlate. If you block that PlateTaker from ordering your plates, half of that fee ($7.50) is returned. Write to support@homecookedplate.com to discuss it. Counts use a rolling 30-day window. Too many chargebacks, refunds, or complaints in that window removes your selling access. One government request for removal does the same. An admin restores selling. Message an admin from this screen.';

export type LostDisputeOutcome = {
  count: number;
  banned: boolean;
  accelerated: boolean;
  firstWarning: boolean;
  warnThirdIsBan: boolean;
  warnFourthIsBan: boolean;
};

export function lostDisputeWindowStart(now: Date = new Date()): string {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - LOST_DISPUTE_WINDOW_MONTHS);
  return start.toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function lostDisputesAccelerated(times: number[]): boolean {
  for (let later = 0; later < times.length; later += 1) {
    for (let earlier = 0; earlier < later; earlier += 1) {
      if (times[later] - times[earlier] <= LOST_DISPUTE_ACCELERATE_DAYS * DAY_MS) return true;
    }
  }
  return false;
}

export function lostDisputeOutcome(disputeTimes: string[], now: Date = new Date()): LostDisputeOutcome {
  const start = new Date(lostDisputeWindowStart(now)).getTime();
  const end = now.getTime();
  const times = disputeTimes
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time) && time >= start && time <= end)
    .sort((a, b) => a - b);
  const count = times.length;
  const accelerated = count >= LOST_DISPUTE_ACCELERATE_COUNT && lostDisputesAccelerated(times);
  const banned = count >= LOST_DISPUTE_BAN_COUNT || (accelerated && count >= LOST_DISPUTE_ACCELERATE_BAN_COUNT);
  return {
    count,
    banned,
    accelerated,
    firstWarning: count === 1,
    warnThirdIsBan: count === LOST_DISPUTE_ACCELERATE_COUNT && accelerated,
    warnFourthIsBan: count === LOST_DISPUTE_ACCELERATE_BAN_COUNT && !accelerated,
  };
}

export function lostDisputeCookNotice(platetakerName: string): { title: string; body: string } {
  return {
    title: 'Lost dispute fee',
    body: `${platetakerName} lost a card dispute on a plate you sold. You are charged $15. HomeCookedPlate does not pay this fee. It is taken from your Stripe balance, or from your next payout when that balance cannot cover it. You can block ${platetakerName} from ordering your plates. After that block, half of this fee ($7.50) is returned. Write to ${SUPPORT_EMAIL} to discuss it.`,
  };
}

export function lostDisputeBuyerNotice(outcome: LostDisputeOutcome): { title: string; body: string } {
  const fee = 'The cook is charged a $15 fee for this lost dispute.';
  const countLine = `You have ${outcome.count} lost dispute${outcome.count === 1 ? '' : 's'} in the last 12 months.`;
  const support = `Write to ${SUPPORT_EMAIL} to discuss it.`;
  if (outcome.banned && outcome.accelerated && outcome.count < LOST_DISPUTE_BAN_COUNT) {
    return {
      title: 'Account permanently banned',
      body: `A lost dispute is on your account. ${fee} ${countLine} 2 of those happened within 60 days, so this account is permanently banned on this 3rd dispute. ${support}`,
    };
  }
  if (outcome.banned) {
    return {
      title: 'Account permanently banned',
      body: `A lost dispute is on your account. ${fee} ${countLine} 4 lost disputes in a rolling 12 months permanently ban this account. ${support}`,
    };
  }
  if (outcome.warnThirdIsBan) {
    return {
      title: 'Lost dispute recorded',
      body: `A lost dispute is on your account. ${fee} ${countLine} A 2nd lost dispute fell within 60 days, so a 3rd lost dispute permanently bans you. ${support}`,
    };
  }
  if (outcome.warnFourthIsBan) {
    return {
      title: 'Lost dispute recorded',
      body: `A lost dispute is on your account. ${fee} ${countLine} A 4th lost dispute in that period permanently bans you. ${support}`,
    };
  }
  if (outcome.firstWarning) {
    return {
      title: 'Lost dispute recorded',
      body: `A lost dispute is on your account. ${fee} ${countLine} 4 lost disputes in a rolling 12 months permanently ban you. If a 2nd lost dispute falls within 60 days, the ban happens on the 3rd. ${support}`,
    };
  }
  return {
    title: 'Lost dispute recorded',
    body: `A lost dispute is on your account. ${fee} ${countLine} 4 lost disputes in a rolling 12 months permanently ban you. If 2 fall within 60 days, the ban happens on the 3rd. ${support}`,
  };
}

export function salesCapForCook(input: {
  accountStartedAt: Date;
  chargebacks: number;
  complaints: number;
  now?: Date;
}): { weekly: number; monthly: number; clearDays: number } {
  const now = input.now ?? new Date();
  const started = input.accountStartedAt.getTime();
  const ageMs = now.getTime() - started;
  const ageDays = Number.isFinite(ageMs) && ageMs > 0 ? Math.floor(ageMs / DAY_MS) : 0;
  const restricted = input.chargebacks > 0 || input.complaints > 0;
  const clearDays = restricted ? 0 : ageDays;
  return { ...salesVolumeCap(clearDays), clearDays };
}

export function salesVolumeBlockMessage(
  cap: { weekly: number; monthly: number },
  weeklySales: number,
  monthlySales: number,
  nextSale: number,
): string | null {
  if (weeklySales + nextSale > cap.weekly) {
    return `This cook is at the $${cap.weekly.toLocaleString('en-US')} sales limit for 7 days.`;
  }
  if (monthlySales + nextSale > cap.monthly) {
    return `This cook is at the $${cap.monthly.toLocaleString('en-US')} sales limit for 30 days.`;
  }
  return null;
}

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
