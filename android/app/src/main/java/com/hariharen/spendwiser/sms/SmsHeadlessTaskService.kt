package com.hariharen.spendwiser.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class SmsHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        
        val originatingAddress = extras.getString("originatingAddress") ?: ""
        val messageBody = extras.getString("messageBody") ?: ""

        val data = Arguments.createMap().apply {
            putString("originatingAddress", originatingAddress)
            putString("messageBody", messageBody)
        }

        return HeadlessJsTaskConfig(
            "SpendWiserSmsTask",
            data,
            10000, // Timeout of 10 seconds
            true // Important: false kills it if app is in foreground. True allows it in foreground!
        )
    }
}
