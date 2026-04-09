import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueuedSms, ActivityLogEntry, AppSettings } from '../types';
import { extractSummary } from '../utils/filter';

const QUEUE_KEY = 'sms_queue';
const ACTIVITY_LOG_KEY = 'activity_log';
const SETTINGS_KEY = 'app_settings';

const DEFAULT_WEBHOOK_URL = 'https://spenditwiser.netlify.app/.netlify/functions/process-sms';

export const getSettings = async (): Promise<AppSettings> => {
  const data = await AsyncStorage.getItem(SETTINGS_KEY);
  if (data) return JSON.parse(data);
  return {
    apiKey: '',
    isListening: false,
    webhookUrl: DEFAULT_WEBHOOK_URL,
  };
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getQueue = async (): Promise<QueuedSms[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveQueue = async (queue: QueuedSms[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const addToQueue = async (smsText: string): Promise<void> => {
  const queue = await getQueue();
  queue.push({
    id: Math.random().toString(36).substring(7),
    smsText,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
  await saveQueue(queue);
};

export const getLog = async (): Promise<ActivityLogEntry[]> => {
  const data = await AsyncStorage.getItem(ACTIVITY_LOG_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveLog = async (log: ActivityLogEntry[]): Promise<void> => {
  // Keep only the last 50 entries
  const trimmed = log.slice(-50);
  await AsyncStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(trimmed));
};

export const addToLog = async (entry: Omit<ActivityLogEntry, 'id' | 'timestamp' | 'summary'>): Promise<void> => {
  const log = await getLog();
  log.unshift({
    ...entry,
    id: Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    summary: extractSummary(entry.smsText),
  });
  await saveLog(log);
};

export const forwardToWebhook = async (apiKey: string, webhookUrl: string, smsText: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey,
        smsText,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, error: error.name === 'AbortError' ? 'Request timed out' : error.message };
  }
};

export const processQueue = async (apiKey: string, webhookUrl: string): Promise<void> => {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const newQueue: QueuedSms[] = [];
  for (const item of queue) {
    if (item.retryCount >= 5) {
      await addToLog({
        smsText: item.smsText,
        status: 'failed',
        error: 'Max retries reached',
      });
      continue;
    }

    const result = await forwardToWebhook(apiKey, webhookUrl, item.smsText);
    if (result.success) {
      await addToLog({
        smsText: item.smsText,
        status: 'success',
      });
    } else {
      newQueue.push({
        ...item,
        retryCount: item.retryCount + 1,
        lastRetryAt: new Date().toISOString(),
        error: result.error,
      });
    }
  }
  await saveQueue(newQueue);
};
