export interface PendingTransaction {
  id: string;
  smsText: string;
  extractedAmount?: number;
  extractedMerchant?: string;
  extractedType?: 'income' | 'expense';
  status: 'pending' | 'approved' | 'rejected';
  receivedAt: string; // ISO date string
}

export interface QueuedSms {
  id: string;
  smsText: string;
  timestamp: string;
  retryCount: number;
  lastRetryAt?: string;
  error?: string;
}

export interface ScoreBreakdown {
  signal: string;
  points: number;
}

export interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown[];
  isTransaction: boolean;
}

export interface ActivityLogEntry {
  id: string;
  smsText: string;
  summary: string;
  timestamp: string;
  status: 'success' | 'failed' | 'queued';
  error?: string;
  score?: number;
  breakdown?: ScoreBreakdown[];
  sender?: string;
}

export interface AppSettings {
  apiKey: string;
  isListening: boolean;
  webhookUrl: string;
}
