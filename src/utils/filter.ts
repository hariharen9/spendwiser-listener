import { ScoringResult, ScoreBreakdown } from '../types';

// ─────────────────────────────────────────────
// HARD EXCLUDE — immediately reject these
// Uses word-boundary matching to avoid false kills
// ─────────────────────────────────────────────
const HARD_EXCLUDE_PATTERNS: RegExp[] = [
  /\botp\b/i,
  /\bone[- ]?time[- ]?password\b/i,
  /\bverification[- ]?code\b/i,
  /\bcvv\b/i,
  /\b(?:enter|your|verify)\s+(?:the\s+)?(?:otp|code|password)\b/i,
];

// ─────────────────────────────────────────────
// SIGNAL 1: Currency-prefixed/suffixed amount
// Only Rs., INR, ₹, $ with adjacent digits
// NO bare number fallback — that was the root bug
// ─────────────────────────────────────────────
const CURRENCY_AMOUNT_PATTERNS: RegExp[] = [
  /(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?/i,        // Prefix: Rs.450.00, INR 5,000
  /[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr|₹)/i,          // Suffix: 450.00 Rs
  /(?:usd|us\$|\$)\s*[\d,]+(?:\.\d{1,2})?/i,          // USD prefix
  /[\d,]+(?:\.\d{1,2})?\s*(?:usd|us\$|\$)/i,          // USD suffix
];
const CURRENCY_AMOUNT_POINTS = 30;

// ─────────────────────────────────────────────
// SIGNAL 2: Strong keywords
// Words used almost exclusively in bank transaction SMS
// ─────────────────────────────────────────────
const STRONG_KEYWORDS: RegExp[] = [
  /\bdebited\b/i,
  /\bcredited\b/i,
  /\bwithdrawn\b/i,
  /\bcharged\b/i,
  /\bspent\b/i,
];
const STRONG_KEYWORD_POINTS = 25;

// ─────────────────────────────────────────────
// SIGNAL 3: Account / Card pattern
// Matches: A/c XX1234, card ending 5678, acct no 1234
// ─────────────────────────────────────────────
const ACCOUNT_PATTERNS: RegExp[] = [
  /(?:a\/c|acct?\.?|account)\s*(?:no\.?\s*)?(?:ending\s+|xx?|[x*]+)?\s*\d{4}/i,
  /card\s*(?:no\.?\s*)?(?:ending\s*|xx?|[x*]+)?\s*\d{4}/i,
  /(?:a\/c|acct?\.?|account)\s*(?:no\.?\s*)?[x*]+\d{3,}/i,
];
const ACCOUNT_PATTERN_POINTS = 20;

// ─────────────────────────────────────────────
// SIGNAL 4: Balance indicator
// "Avl Bal", "Available Balance", "Net Bal", "Bal:"
// Almost exclusively in bank SMS
// ─────────────────────────────────────────────
const BALANCE_PATTERNS: RegExp[] = [
  /(?:avl\.?|available|net|a\/c|closing)\s*bal(?:ance)?/i,
  /\bbal(?:ance)?\s*(?:is|:)\s*(?:rs\.?|inr|₹)/i,
];
const BALANCE_INDICATOR_POINTS = 15;

// ─────────────────────────────────────────────
// SIGNAL 5: Medium keywords
// Banking-context words — need other signals to pass
// ─────────────────────────────────────────────
const MEDIUM_KEYWORDS: RegExp[] = [
  /\bpayment\b/i,
  /\btxn\b/i,
  /\btransaction\b/i,
  /\bemi\b/i,
  /\bauto[- ]?debit\b/i,
  /\bupi\b/i,
  /\bneft\b/i,
  /\bimps\b/i,
  /\brtgs\b/i,
  /\brefund(?:ed)?\b/i,
  /\bcashback\b/i,
  /\bpurchase\b/i,
  /\bwithdrawal\b/i,
  /\breversed\b/i,
  /\bsettled\b/i,
  /\bdeposit(?:ed)?\b/i,
  /\btransfer(?:red)?\b/i,
  /\bpaid\b/i,
];
const MEDIUM_KEYWORD_POINTS = 15;

// ─────────────────────────────────────────────
// SIGNAL 6: Sender pattern
// Alphanumeric DLT header (XX-HDFCBK-X) = +10
// Personal phone number (10+ digits) = -10
// ─────────────────────────────────────────────
const SENDER_ALPHANUMERIC_POINTS = 10;
const SENDER_PHONE_PENALTY = -10;

// ─────────────────────────────────────────────
// THRESHOLD
// ─────────────────────────────────────────────
const FORWARD_THRESHOLD = 60;

/**
 * Checks if a sender looks like a registered business/bank DLT header
 * (contains alphabetic characters, not just digits).
 * Examples: "XX-HDFCBK-T", "CP-BOBONE-X", "VM-SBIBNK"
 */
function isSenderAlphanumeric(sender: string): boolean {
  if (!sender || sender.trim().length === 0) return false;
  const cleaned = sender.replace(/[-\s]/g, '');
  // Must have at least some letters — pure digits = promo/personal
  return /[a-zA-Z]/.test(cleaned) && cleaned.length >= 4;
}

/**
 * Checks if a sender looks like a personal phone number (10+ digits).
 */
function isSenderPhoneNumber(sender: string): boolean {
  if (!sender) return false;
  const digitsOnly = sender.replace(/[^0-9]/g, '');
  return digitsOnly.length >= 10;
}

/**
 * The core scoring function. Returns a detailed scoring result
 * with breakdown explaining each signal contribution.
 */
export function scoreTransactionSms(sender: string, message: string): ScoringResult {
  const breakdown: ScoreBreakdown[] = [];
  let score = 0;

  // ── HARD EXCLUDE: OTP / Auth messages ──
  const lower = message.toLowerCase();
  for (const pattern of HARD_EXCLUDE_PATTERNS) {
    if (pattern.test(lower)) {
      breakdown.push({ signal: `Excluded: "${message.match(pattern)?.[0] || 'auth keyword'}"`, points: 0 });
      return { score: 0, breakdown: [{ signal: 'Hard-excluded (OTP / auth message)', points: 0 }], isTransaction: false };
    }
  }

  // ── Signal 1: Currency amount ──
  const hasCurrencyAmount = CURRENCY_AMOUNT_PATTERNS.some(p => p.test(message));
  if (hasCurrencyAmount) {
    score += CURRENCY_AMOUNT_POINTS;
    breakdown.push({ signal: 'Currency amount detected', points: CURRENCY_AMOUNT_POINTS });
  }

  // ── Signal 2: Strong keywords ──
  let strongMatched = false;
  for (const kw of STRONG_KEYWORDS) {
    if (kw.test(message)) {
      const match = message.match(kw);
      score += STRONG_KEYWORD_POINTS;
      breakdown.push({ signal: `Strong keyword: "${match?.[0]}"`, points: STRONG_KEYWORD_POINTS });
      strongMatched = true;
      break; // Only count one strong keyword
    }
  }

  // ── Signal 3: Account pattern ──
  const hasAccount = ACCOUNT_PATTERNS.some(p => p.test(message));
  if (hasAccount) {
    score += ACCOUNT_PATTERN_POINTS;
    breakdown.push({ signal: 'Account/card pattern', points: ACCOUNT_PATTERN_POINTS });
  }

  // ── Signal 4: Balance indicator ──
  const hasBalance = BALANCE_PATTERNS.some(p => p.test(message));
  if (hasBalance) {
    score += BALANCE_INDICATOR_POINTS;
    breakdown.push({ signal: 'Balance indicator', points: BALANCE_INDICATOR_POINTS });
  }

  // ── Signal 5: Medium keywords (only if no strong keyword matched) ──
  if (!strongMatched) {
    let mediumCount = 0;
    for (const kw of MEDIUM_KEYWORDS) {
      if (kw.test(message) && mediumCount < 2) { // Cap at 2 medium keywords
        const match = message.match(kw);
        score += MEDIUM_KEYWORD_POINTS;
        breakdown.push({ signal: `Medium keyword: "${match?.[0]}"`, points: MEDIUM_KEYWORD_POINTS });
        mediumCount++;
      }
    }
  }

  // ── Signal 6: Sender pattern ──
  if (isSenderAlphanumeric(sender)) {
    score += SENDER_ALPHANUMERIC_POINTS;
    breakdown.push({ signal: 'Alphanumeric sender', points: SENDER_ALPHANUMERIC_POINTS });
  } else if (isSenderPhoneNumber(sender)) {
    score += SENDER_PHONE_PENALTY;
    breakdown.push({ signal: 'Phone number sender', points: SENDER_PHONE_PENALTY });
  }

  return {
    score,
    breakdown,
    isTransaction: score >= FORWARD_THRESHOLD,
  };
}

/**
 * Legacy-compatible wrapper — returns boolean.
 * Used by shouldForwardSms for backward compat.
 */
export function isTransactionSms(message: string): boolean {
  return scoreTransactionSms('', message).isTransaction;
}

/**
 * Legacy-compatible wrapper — calls the scoring function.
 */
export function shouldForwardSms(sender: string, message: string): boolean {
  return scoreTransactionSms(sender, message).isTransaction;
}

/**
 * Extracts a human-readable summary from SMS text for the activity log.
 */
export function extractSummary(smsText: string): string {
  const amountMatch = smsText.match(/(?:rs\.?|inr|₹|\$)\s*([\d,]+\.?\d*)/i) || smsText.match(/([\d,]+\.?\d*)/);
  const amount = amountMatch ? amountMatch[1] : '?';

  const isDebit = /debit|spent|paid|charged|withdrawn/i.test(smsText);
  const prefix = isDebit ? '💸' : '💰';

  // Try to find a merchant/context
  const merchantMatch = smsText.match(/(?:at|to|on|from)\s+([A-Za-z0-9\s]{3,15})/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Transaction';

  return `${prefix} Rs.${amount} (${merchant})`;
}
