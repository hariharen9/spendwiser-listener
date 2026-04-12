package com.hariharen.spendwiser.sms

import android.database.Cursor
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*

class SmsInboxModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SmsInboxReader"

    /**
     * Reads SMS messages from the device inbox received after [sinceTimestamp] (epoch ms).
     * Returns a JS array of { address: string, body: string, date: number }
     */
    @ReactMethod
    fun getRecentMessages(sinceTimestamp: Double, promise: Promise) {
        try {
            val messages = Arguments.createArray()
            val cutoffTime = sinceTimestamp.toLong()

            val cursor: Cursor? = reactApplicationContext.contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("address", "body", "date"),
                "date > ?",
                arrayOf(cutoffTime.toString()),
                "date DESC"
            )

            cursor?.use {
                val addrIdx = it.getColumnIndex("address")
                val bodyIdx = it.getColumnIndex("body")
                val dateIdx = it.getColumnIndex("date")

                while (it.moveToNext()) {
                    val msg = Arguments.createMap().apply {
                        putString("address", if (addrIdx >= 0) it.getString(addrIdx) ?: "" else "")
                        putString("body", if (bodyIdx >= 0) it.getString(bodyIdx) ?: "" else "")
                        putDouble("date", if (dateIdx >= 0) it.getLong(dateIdx).toDouble() else 0.0)
                    }
                    messages.pushMap(msg)
                }
            }

            Log.d("SpendWiserSms", "Inbox catch-up: found ${messages.size()} messages since $cutoffTime")
            promise.resolve(messages)
        } catch (e: Exception) {
            Log.e("SpendWiserSms", "Failed to read SMS inbox", e)
            promise.reject("SMS_READ_ERROR", e.message, e)
        }
    }
}
