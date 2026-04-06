const TRANSACTION_KEYWORDS = [
  'debited', 'debit', 'spent', 'paid', 'purchase',
  'withdrawn', 'withdrawal', 'transfer', 'sent',
  'credited', 'credit', 'received', 'refund', 'refunded',
  'deposited', 'deposit', 'cashback',
];

const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr|₹|usd|\$)\s*[\d,]+\.?\d*/i, // Currency prefix: Rs. 100
  /[\d,]+\.?\d*\s*(?:rs\.?|inr|₹|usd|\$)/i, // Currency suffix: 100 Rs
  /\b\d+(?:\.\d{2})?\b/,                    // Any plain number/decimal
];

export function isTransactionSms(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Basic keywords check
  const hasKeyword = TRANSACTION_KEYWORDS.some(kw => lower.includes(kw));
  
  // Basic amount check (any digit sequence)
  const hasAmount = AMOUNT_PATTERNS.some(pattern => pattern.test(message));
  
  return hasKeyword && hasAmount;
}

export function shouldForwardSms(sender: string, message: string): boolean {
  // We no longer care if the sender is a bank shortcode.
  // If it looks like a transaction, we forward it.
  return isTransactionSms(message);
}

export function extractSummary(smsText: string): string {
  const amountMatch = smsText.match(/(?:rs\.?|inr|₹|\$)\s*([\d,]+\.?\d*)/i) || smsText.match(/([\d,]+\.?\d*)/);
  const amount = amountMatch ? amountMatch[1] : '?';
  
  const isDebit = /debit|spent|paid|sent/i.test(smsText);
  const prefix = isDebit ? '💸' : '💰';
  
  // Try to find a merchant/context
  const merchantMatch = smsText.match(/(?:at|to|on|from)\s+([A-Za-z0-9\s]{3,15})/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Transaction';
  
  return `${prefix} Rs.${amount} (${merchant})`;
}
