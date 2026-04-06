declare module 'react-native-android-sms-listener' {
  interface SmsMessage {
    originatingAddress: string;
    body: string;
    timestamp: number;
  }

  interface Subscription {
    remove: () => void;
  }

  interface SmsListenerStatic {
    addListener(handler: (message: SmsMessage) => void): Subscription;
  }

  const SmsListener: SmsListenerStatic;
  export default SmsListener;
}
