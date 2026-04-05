const BANK_SENDER_PATTERNS = [
  /^[A-Z]{2}-[A-Z]{6}$/,     // e.g., "VM-HDFCBK", "AX-ICICIB"
  /^[A-Z]{2}-[A-Z]{5,}$/,    // Various bank codes
  /^[A-Z]{6,}$/,             // Some phones strip the prefix
  /^\d{6}$/,                 // 6-digit short codes
];

const TRANSACTION_KEYWORDS = [
  // Debit indicators
  'debited', 'debit', 'spent', 'paid', 'purchase',
  'withdrawn', 'withdrawal', 'transfer', 'sent',
  
  // Credit indicators
  'credited', 'credit', 'received', 'refund', 'refunded',
  'deposited', 'deposit', 'cashback',
  
  // Amount patterns
  'rs.', 'rs ', 'inr', 'rupee', '₹',
  
  // Account indicators
  'a/c', 'ac ', 'acct', 'account',
  'card', 'xxxx', 'xx',
];

const EXCLUDE_KEYWORDS = [
  'otp', 'one time password', 'verification code',
  'login', 'password', 'reset',
];

export function isBankSender(sender: string): boolean {
  return BANK_SENDER_PATTERNS.some(pattern => pattern.test(sender));
}

export function isTransactionSms(message: string): boolean {
  const lower = message.toLowerCase();
  
  // Exclude OTPs and auth messages
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // Must contain at least one transaction keyword
  const hasKeyword = TRANSACTION_KEYWORDS.some(kw => lower.includes(kw));
  
  // Must contain an amount pattern (Rs., INR, or number with currency)
  const hasAmount = /(?:rs\.?|inr|₹)\s*[\d,]+/i.test(message) || 
                    /[\d,]+\.?\d*\s*(?:rs\.?|inr|₹)/i.test(message);
  
  return hasKeyword && hasAmount;
}

export function shouldForwardSms(sender: string, message: string): boolean {
  // If the sender looks like a bank OR the message content looks like a transaction
  return isBankSender(sender) || isTransactionSms(message);
}

export function extractSummary(smsText: string): string {
  const amountMatch = smsText.match(/(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i);
  const amount = amountMatch ? amountMatch[1] : '?';
  
  const merchantMatch = smsText.match(/(?:at|to|on)\s+([A-Za-z0-9\s]+?)(?=\s|$|\.)/i);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
  
  const isDebit = /debit|spent|paid/i.test(smsText);
  const prefix = isDebit ? '💸' : '💰';
  
  return `${prefix} Rs.${amount} at ${merchant}`;
}
