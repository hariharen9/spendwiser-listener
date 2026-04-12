import { NativeModules } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings, getLog, forwardToWebhook, addToQueue, addToLog, processQueue } from './api';
import { shouldForwardSms } from '../utils/filter';

const QUEUE_TASK = 'BACKGROUND_QUEUE_TASK';
const LAST_CATCHUP_KEY = 'last_catchup_ts';

TaskManager.defineTask(QUEUE_TASK, async () => {
  try {
    const settings = await getSettings();
    if (settings.apiKey && settings.isListening) {
      await processQueue(settings.apiKey, settings.webhookUrl);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerQueueTask = async () => {
  return BackgroundFetch.registerTaskAsync(QUEUE_TASK, {
    minimumInterval: 60, // 1 minute — OS will throttle to its own minimum, but we signal intent for fastest cadence
    stopOnTerminate: false,
    startOnBoot: true,
  });
};

// -----
// HEADLESS JS HANDLER (Native Android Kotlin trigger)
// -----
export const headlessSmsHandler = async (taskData: { originatingAddress: string, messageBody: string }) => {
  console.log('[SpendWiser Headless] Woke up for SMS:', taskData);
  const { originatingAddress, messageBody } = taskData;

  const settings = await getSettings();
  if (!settings.apiKey || !settings.isListening) {
    console.log('[SpendWiser Headless] App is explicitly set to Stop or Missing API Key. Ignoring.');
    return;
  }

  if (shouldForwardSms(originatingAddress, messageBody)) {
    const messageId = Math.random().toString(36).substring(7);
    const result = await forwardToWebhook(settings.apiKey, settings.webhookUrl, messageBody);
    if (result.success) {
      await addToLog({ id: messageId, smsText: messageBody, status: 'success' });
      console.log('[SpendWiser Headless] Forwarded successfully.');
    } else {
      await addToQueue(messageId, messageBody);
      await addToLog({ id: messageId, smsText: messageBody, status: 'queued', error: result.error });
      console.log(`[SpendWiser Headless] Forward failed, queued. Error: ${result.error}`);
    }
  } else {
    await addToLog({
      smsText: messageBody,
      status: 'failed',
      error: 'Filtered out (no bank keywords/amount)',
    });
    console.log('[SpendWiser Headless] Filtered out.');
  }
};

// -----
// SMS INBOX CATCH-UP (Safety net for missed broadcasts)
// -----

const getLastCatchUpTimestamp = async (): Promise<number> => {
  const ts = await AsyncStorage.getItem(LAST_CATCHUP_KEY);
  if (ts) return parseInt(ts, 10);
  // First run: default to 24 hours ago
  return Date.now() - 24 * 60 * 60 * 1000;
};

const setLastCatchUpTimestamp = async (ts: number): Promise<void> => {
  await AsyncStorage.setItem(LAST_CATCHUP_KEY, ts.toString());
};

/**
 * Scans the device SMS inbox for transaction messages that were missed by the
 * BroadcastReceiver (e.g., when the app was killed and HeadlessJS failed to boot).
 * Only processes messages that pass the transaction filter and aren't already logged.
 * Returns the number of newly caught-up transactions.
 */
export const catchUpMissedSms = async (): Promise<number> => {
  const { SmsInboxReader } = NativeModules;
  if (!SmsInboxReader) {
    console.warn('[SpendWiser CatchUp] SmsInboxReader native module not available');
    return 0;
  }

  const settings = await getSettings();
  if (!settings.apiKey || !settings.isListening) return 0;

  try {
    const lastTs = await getLastCatchUpTimestamp();
    console.log(`[SpendWiser CatchUp] Scanning inbox for SMS since ${new Date(lastTs).toISOString()}`);

    const messages: Array<{ address: string; body: string; date: number }> =
      await SmsInboxReader.getRecentMessages(lastTs);

    if (!messages || messages.length === 0) {
      console.log('[SpendWiser CatchUp] No new messages in inbox.');
      return 0;
    }

    // Build a set of already-processed SMS bodies to deduplicate
    const currentLog = await getLog();
    const processedTexts = new Set(currentLog.map((e) => e.smsText));

    let catchUpCount = 0;
    let newestTimestamp = lastTs;

    for (const msg of messages) {
      // Always advance the cursor past this message
      if (msg.date > newestTimestamp) newestTimestamp = msg.date;

      const body = msg.body?.trim();
      if (!body || processedTexts.has(body)) continue;

      // Only catch up on transaction SMS — skip spam/promos to avoid log flooding
      if (shouldForwardSms(msg.address || '', body)) {
        const messageId = Math.random().toString(36).substring(7);
        const result = await forwardToWebhook(settings.apiKey, settings.webhookUrl, body);
        if (result.success) {
          await addToLog({ id: messageId, smsText: body, status: 'success' });
        } else {
          await addToQueue(messageId, body);
          await addToLog({ id: messageId, smsText: body, status: 'queued', error: result.error });
        }
        catchUpCount++;
      }

      processedTexts.add(body);
    }

    // Advance cursor so we never re-scan these messages
    if (newestTimestamp > lastTs) {
      await setLastCatchUpTimestamp(newestTimestamp);
    }

    console.log(`[SpendWiser CatchUp] Done. Caught up ${catchUpCount} missed transaction(s).`);
    return catchUpCount;
  } catch (error) {
    console.error('[SpendWiser CatchUp] Inbox scan failed:', error);
    return 0;
  }
};

// Start/Stop are now dummy functions so we don't break the App.tsx UI. 
// They don't need to do anything natively because the Kotlin listener lives in AndroidManifest permanently now!
export const startSmsListener = () => { console.log('[SpendWiser] System listens natively.'); };
export const stopSmsListener = () => { console.log('[SpendWiser] Stop clicked (will filter out natively).'); };

