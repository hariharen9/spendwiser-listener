import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { getSettings, forwardToWebhook, addToQueue, addToLog, processQueue } from './api';
import { shouldForwardSms } from '../utils/filter';

const SMS_TASK = 'BACKGROUND_SMS_TASK';
const QUEUE_TASK = 'BACKGROUND_QUEUE_TASK';

// Define the background fetch task for queue processing
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

export const startSmsListener = async () => {
  const settings = await getSettings();
  if (!settings.apiKey || !settings.isListening) return;

  const { SmsListener } = NativeModules;
  if (!SmsListener) {
    console.warn('SmsListener native module not found. Make sure you are running a development build.');
    return;
  }

  const smsEmitter = new NativeEventEmitter(SmsListener);
  
  const handleSms = async (event: { body: string; sender: string }) => {
    const { body, sender } = event;
    
    if (shouldForwardSms(sender, body)) {
      const result = await forwardToWebhook(settings.apiKey, settings.webhookUrl, body);
      if (result.success) {
        await addToLog({ smsText: body, status: 'success' });
      } else {
        await addToQueue(body);
        await addToLog({ smsText: body, status: 'queued', error: result.error });
      }
    }
  };

  smsEmitter.addListener('onSmsReceived', handleSms);
};
