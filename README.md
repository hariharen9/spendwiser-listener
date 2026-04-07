# 📱 SpendWiser Listener (Android Companion App)

> **Zero Manual Data Entry.** Automate your personal finance tracking with total privacy. 

SpendWiser Listener is the official Android companion app for [SpendWiser](https://spenditwiser.netlify.app/), an advanced personal finance tracking platform. This open-source companion app runs silently in the background of your Android phone, intercepts bank SMS alerts, and automatically syncs them to your SpendWiser dashboard.

Due to strict Google Play Store policies regarding SMS permissions, this app cannot be distributed via the official store. Instead, we provide this repository so you can rely on full transparency: verify the code yourself, build the application directly from the source, or safely download the latest release knowing your financial data remains solely in your hands.

---

## 🔒 Security & Privacy First

I built this app knowing that financial SMS data is incredibly sensitive. Here is why you can trust it:

- **100% Open Source:** Every single line of code is open. You can verify exactly what the app does before installing it.
- **Strict Local Filtering:** Not every SMS leaves your phone. The app uses an intelligent on-device regex filter to instantly discard personal messages, OTPs, and promotional texts. **Only** SMS messages containing transaction keywords (like "debited", "credited") paired with monetary amounts (e.g., "Rs. 450") are processed.
- **Direct to Your Dashboard:** Your data is forwarded **directly** to your cloud SpendWiser backend via a secure HTTPS webhook, authorized purely by your personal, unique API Key. **I do not run any third-party analytics, telemetry, or middleman servers.**
- **Minimal Permissions Needed:** The app only requests `RECEIVE_SMS` and `READ_SMS`, along with standard background service permissions to stay active. It **never** asks for your contacts, location, camera, or excessive storage permissions.

---

## ⚙️ How It Works

1. **Native OS Hook:** The app registers a lightweight `BroadcastReceiver` at the Android OS level. Even if the app is completely closed or your phone is locked, the operating system wakes the app up the precise millisecond an SMS arrives.
2. **Background Execution:** It utilizes a Headless JS service bundled with a WakeLock to securely and silently process the message without disrupting your phone usage.
3. **Smart Parsing:** Once the SMS is strictly filtered and validated, it's immediately forwarded to the SpendWiser Webhook.
4. **Offline Resilience:** No internet? No problem. The app gracefully queues the transaction locally and securely retries forwarding it repeatedly once your connection is restored.
5. **Dashboard Magic:** Once received by the SpendWiser app, our backend processes the text to extract the exact merchant and amount, placing it directly in your dashboard for an easy 1-click review.

---

## 🛠️ Step-by-Step Setup Guide

If you simply want to use the app, download the latest APK from our **Releases** tab, sideload it, and skip to **Step 4**. If you prefer to verify the source and build it yourself, follow the detailed instructions below!

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/) (LTS recommended)
- [Git](https://git-scm.com/)
- [EAS CLI](https://expo.dev/eas) (`npm install -g eas-cli`)
- An [Expo Account](https://expo.dev/) (Free)

### 2. Clone the Repository
```bash
git clone https://github.com/hariharen9/spendwiser-listener.git
cd spendwiser-listener-app
```

### 3. Build the APK via EAS
Because this app utilizes native Android code (specifically Kotlin implementations for background processing and BroadcastReceivers) instead of traditional React Native logic alone, we use Expo Application Services (EAS) to compile it into a production-ready APK.

```bash
# Install project dependencies
npm install

# Login to Expo
eas login

# Configure EAS (if running for the first time)
eas build:configure

# Build the Android APK
eas build --platform android --profile preview
```

Once the build is complete, your terminal will provide a secure link to download the `.apk` file directly to your Android device or computer.

### 4. Installation & Linking to SpendWiser

1. Download the `.apk` file to your Android phone.
2. When prompted, permit your device to **Install from Unknown Sources** in Settings.
3. Open the **SpendWiser Listener** application.
4. On your PC or Phone browser, log into your [SpendWiser Dashboard](https://spenditwiser.netlify.app/).
5. Navigate to **Settings > SMS Automation**.
6. Click **Generate API Key** and copy the securely generated sequence.
7. Paste this API Key into the SpendWiser Listener Android App and tap **Save**.
8. The app will prompt for SMS permissions. Grant them.

That's it! Whenever you swipe your bank card, send money via UPI, or receive a salary deposit, the app will instantly detect it and queue the transaction securely in SpendWiser for your review.

---

## 🤔 Frequently Asked Questions (FAQ)

**Q: Will this drain my battery?**
A: No. Unlike older background apps that constantly poll the system, this application is event-driven. The Android OS triggers the app *only* when an SMS is received, minimizing battery usage to nearly 0%.

**Q: Why don't I see my new transactions appearing?**
A: Ensure your phone's restrictive battery settings aren't killing the background service. Navigate to `Settings > Apps > SpendWiser Listener > Battery` and select **Unrestricted** (or "No Restrictions"). You can completely debug failures directly from the "Activity Log" visible inside the app.

**Q: Can I revoke my API key?**
A: Yes! Head back to your SpendWiser Dashboard's Automation Settings and click Revoke. The companion app will immediately lose authorization to post to your account, discarding any future requests safely.

---

## 💻 Tech Stack
- **Framework:** React Native (Expo)
- **Language:** TypeScript & Kotlin (for robust Native Modules)
- **Background Tasks:** Android `BroadcastReceiver` coupled tightly with React Native Headless JS tasks

---
*Built for the community, ensuring you take full control of your finances—effortlessly and privately.*
