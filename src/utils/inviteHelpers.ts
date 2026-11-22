/**
 * Isla Prestada invites helper utilities:
 * - Human-readable dates and elapsed time.
 * - Clear distinction between enforced expiration (backend-defined) and suggested review window (client-side 14-day guidance).
 * - Safe timestamp handling for invalid or missing values.
 */

export const DEFAULT_LOAN_SUGGESTED_DURATION_DAYS = 14;

export interface SuggestedWindowResult {
  suggestedDateStr: string;
  isPastSuggestedWindow: boolean;
  daysRemaining: number;
}

export interface ExpirationEvaluation {
  /** True only if backend enforces expiration AND the date has passed */
  isEnforcedExpired: boolean;
  /** Human-readable string of enforced expiration date, if present */
  enforcedExpirationStr?: string;
  /** Suggested review window based on createdAt */
  suggestedReview: SuggestedWindowResult;
}

/**
 * Parses an unknown date/timestamp representation safely.
 * Returns a valid Date or null.
 */
export function parseDateSafe(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    try {
      const d = (val as { toDate: () => Date }).toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Returns a localized human-readable date string, or a fallback if missing/invalid.
 */
export function formatReadableDate(rawDate: unknown): string {
  const d = parseDateSafe(rawDate);
  if (!d) return 'Fecha no disponible';
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns human-readable elapsed time in Spanish (e.g. "hace 5 minutos", "hace 2 días").
 */
export function formatElapsedTime(rawDate: unknown, now: Date = new Date()): string {
  const d = parseDateSafe(rawDate);
  if (!d) return '';

  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return 'hace un momento';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'hace unos segundos';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;

  const diffYears = Math.floor(diffDays / 365);
  return `hace ${diffYears} ${diffYears === 1 ? 'año' : 'años'}`;
}

/**
 * Calculates a suggested review date window from creation date.
 * This is non-enforced guidance; it does NOT mark invitations as expired.
 */
export function getSuggestedReviewWindow(
  createdAtRaw: unknown,
  durationDays: number = DEFAULT_LOAN_SUGGESTED_DURATION_DAYS,
  now: Date = new Date()
): SuggestedWindowResult {
  const d = parseDateSafe(createdAtRaw);
  if (!d) {
    return { suggestedDateStr: '', isPastSuggestedWindow: false, daysRemaining: 0 };
  }

  const reviewDate = new Date(d.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const diffMs = reviewDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    suggestedDateStr: reviewDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    isPastSuggestedWindow: diffMs <= 0,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Evaluates invitation expiration:
 * - Checks for optional enforced backend expiration (`expiresAt`).
 * - Computes client suggested review date.
 * - Guarantees pending invitations are never marked expired without backend confirmation.
 */
export function evaluateInviteExpiration(
  invite: { createdAt?: unknown; expiresAt?: unknown; status?: string },
  now: Date = new Date()
): ExpirationEvaluation {
  let isEnforcedExpired = false;
  let enforcedExpirationStr: string | undefined;

  const expDate = parseDateSafe(invite.expiresAt);
  if (expDate) {
    enforcedExpirationStr = expDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    isEnforcedExpired = expDate.getTime() <= now.getTime();
  }

  const suggestedReview = getSuggestedReviewWindow(
    invite.createdAt,
    DEFAULT_LOAN_SUGGESTED_DURATION_DAYS,
    now
  );

  return {
    isEnforcedExpired,
    enforcedExpirationStr,
    suggestedReview,
  };
}
