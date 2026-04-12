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
                val originatingAddress = messages[0].displayOriginatingAddress ?: ""
                // Concatenate ALL PDU segments — bank SMS often exceeds 160 chars
                // and keywords/amounts may be in part 2+
                val messageBody = messages.joinToString("") { it.displayMessageBody ?: "" }
                
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
