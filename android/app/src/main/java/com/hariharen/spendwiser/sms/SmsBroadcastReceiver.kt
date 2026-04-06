package com.hariharen.spendwiser.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

class SmsBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNotEmpty()) {
                val message = messages[0]
                val originatingAddress = message.displayOriginatingAddress ?: ""
                val messageBody = message.displayMessageBody ?: ""
                
                Log.d("SpendWiserSms", "SMS received from: $originatingAddress")

                val serviceIntent = Intent(context, SmsHeadlessTaskService::class.java)
                serviceIntent.putExtra("originatingAddress", originatingAddress)
                serviceIntent.putExtra("messageBody", messageBody)
                
                context.startService(serviceIntent)
                HeadlessJsTaskService.acquireWakeLockNow(context)
            }
        }
    }
}
