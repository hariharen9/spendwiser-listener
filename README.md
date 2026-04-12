# 📱 SpendWiser Listener (Android Companion App)

> **Zero Manual Data Entry.** Automate your personal finance tracking with total privacy. 

SpendWiser Listener is the official Android companion app for [SpendWiser](https://spenditwiser.netlify.app/), an advanced personal finance tracking platform. This open-source companion app runs silently in the background of your Android phone, intercepts bank SMS alerts, and automatically syncs them to your SpendWiser dashboard.

Due to strict Google Play Store policies regarding SMS permissions, this app cannot be distributed via the official store. Instead, I provide this repository so you can rely on full transparency: verify the code yourself, build the application directly from the source, or safely download the latest release knowing your financial data remains solely in **your** hands.

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

> [!NOTE]
> **Manual Review:** While our smart parsing is highly accurate, it may occasionally misdetect a non-transaction SMS or misinterpret an amount. All detected messages appear in a "Pending" state on your dashboard, giving you full control to **Review, Edit, or Dismiss** them before they are officially recorded.

---

## 🛠️ Step-by-Step Setup Guide

SpendWiser Listener is open-source to ensure total transparency. Most users should follow the **Standard Installation**, but if you're a developer or prefer to verify and build the app yourself, follow the **Advanced: Build from Source** section.

### Standard Installation (Recommended)

1. **Download:** Go to the [**Releases**](https://github.com/hariharen9/spendwiser-listener/releases) tab and download the latest `.apk` file directly to your Android phone.
2. **Install & Sideload:** Follow the [**Installation & Sideloading Guide**](#4-installation--sideloading-guide) below to handle Play Protect and system permissions.
3. **Configure:** Enter your API Key from the SpendWiser dashboard and tap **Start**.

---

### Advanced: Build from Source

If you prefer to compile the application yourself to ensure it matches the source code exactly, follow these steps:

#### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/en/) (LTS recommended)
- [Git](https://git-scm.com/)
- [EAS CLI](https://expo.dev/eas) (`npm install -g eas-cli`)
- An [Expo Account](https://expo.dev/) (Free)

#### 2. Clone the Repository
```bash
git clone https://github.com/hariharen9/spendwiser-listener.git
cd spendwiser-listener-app
```

#### 3. Build the APK via EAS
Because this app utilizes native Android code (specifically Kotlin implementations for background processing and BroadcastReceivers) instead of traditional React Native logic alone, I use Expo Application Services (EAS) to compile it into a production-ready APK.

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

Once the build is complete, your terminal will provide a secure link to download your custom `.apk` file.

---

### 4. Installation & Sideloading Guide

> Since this app uses sensitive SMS permissions and is not distributed through the Play Store, Android will require a few extra steps to install and run correctly.

1. **Download:** Get the latest `.apk` file from the **Releases** tab directly onto your Android phone.
2. **Bypass Play Protect:**
   - When you open the APK, Google Play Protect may show a "Blocked by Play Protect" warning. Tap **"More details"** and then **"Install anyway"**.
   - If the installation still fails, you may need to temporarily pause scanning: Open **Play Store** > Tap your **Profile Icon** > **Play Protect** > **Settings (gear icon)** > Toggle off **"Scan apps with Play Protect"**. (You can re-enable this once the app is installed).
3. **Allow Unknown Sources:** If prompted, permit your browser or file manager to **"Install unknown apps"** in your system settings.
4. **Enable "Restricted Settings" (Android 13+):**
   - On newer Android versions, system permissions for sideloaded apps are restricted by default.
   - If you find you cannot toggle SMS permissions, go to **Settings > Apps > SpendWiser Listener**.
   - Tap the **three dots (⋮)** in the top-right corner and select **"Allow restricted settings"**. Authenticate with your PIN/Biometrics.
5. **Grant SMS Permissions:**
   - Open the **SpendWiser Listener** app.
   - It will prompt for SMS permissions immediately. Tap **Allow**. If it doesn't prompt, go to App Info > Permissions and allow **SMS** manually.
6. **Set Battery to "Unrestricted":**
   - To ensure the app doesn't stop listening in the background, go to **Settings > Apps > SpendWiser Listener > Battery**.
   - Select **"Unrestricted"** (or "No restrictions").
7. **Linking to SpendWiser:**
   - Log into your [SpendWiser Dashboard](https://spenditwiser.netlify.app/).
   - Navigate to **Settings > SMS Automation**.
   - **Generate API Key** and copy it.
   - Paste the key into the app and tap **Save**.
   - Tap **Start** to begin listening. You should see a persistent notification indicating the service is active.

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
