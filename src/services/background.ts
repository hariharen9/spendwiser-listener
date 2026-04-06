import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { getSettings, forwardToWebhook, addToQueue, addToLog, processQueue } from './api';
import { shouldForwardSms } from '../utils/filter';

const QUEUE_TASK = 'BACKGROUND_QUEUE_TASK';

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
    minimumInterval: 15 * 60, // 15 minutes
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
    const result = await forwardToWebhook(settings.apiKey, settings.webhookUrl, messageBody);
    if (result.success) {
      await addToLog({ smsText: messageBody, status: 'success' });
      console.log('[SpendWiser Headless] Forwarded successfully.');
    } else {
      await addToQueue(messageBody);
      await addToLog({ smsText: messageBody, status: 'queued', error: result.error });
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

// Start/Stop are now dummy functions so we don't break the App.tsx UI. 
// They don't need to do anything natively because the Kotlin listener lives in AndroidManifest permanently now!
export const startSmsListener = () => { console.log('[SpendWiser] System listens natively.'); };
export const stopSmsListener = () => { console.log('[SpendWiser] Stop clicked (will filter out natively).'); };
