import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import SmsListener from 'react-native-android-sms-listener';
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

// Holds the subscription so we never register more than one listener
let smsSubscription: { remove: () => void } | null = null;

export const startSmsListener = () => {
  // Avoid duplicate listeners if called multiple times
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
  }

  smsSubscription = SmsListener.addListener(
    async (message: { body: string; originatingAddress: string }) => {
      const { body, originatingAddress } = message;

      console.log(`[SpendWiser] SMS received from ${originatingAddress}: ${body}`);

      // Read settings fresh each time — so the latest API key is always used
      const settings = await getSettings();
      if (!settings.apiKey || !settings.isListening) {
        console.log('[SpendWiser] Listener inactive or no API key — skipping.');
        return;
      }

      if (shouldForwardSms(originatingAddress, body)) {
        const result = await forwardToWebhook(settings.apiKey, settings.webhookUrl, body);
        if (result.success) {
          await addToLog({ smsText: body, status: 'success' });
          console.log('[SpendWiser] Forwarded successfully.');
        } else {
          await addToQueue(body);
          await addToLog({ smsText: body, status: 'queued', error: result.error });
          console.log(`[SpendWiser] Forward failed, queued. Error: ${result.error}`);
        }
      } else {
        // Still log so the user can see the app is at least receiving SMS
        await addToLog({
          smsText: body,
          status: 'failed',
          error: 'Filtered out (no bank keywords/amount)',
        });
        console.log('[SpendWiser] SMS filtered out — not a bank transaction.');
      }
    }
  );

  console.log('[SpendWiser] SMS listener registered.');
};

export const stopSmsListener = () => {
  if (smsSubscription) {
    smsSubscription.remove();
    smsSubscription = null;
    console.log('[SpendWiser] SMS listener stopped.');
  }
};
