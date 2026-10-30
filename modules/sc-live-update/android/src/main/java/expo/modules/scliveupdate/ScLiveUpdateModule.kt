package expo.modules.scliveupdate

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android Live Updates (promoted ongoing notifications: the status-bar chip, the top of the shade and the lock screen) for the S&C app's
// workout in progress and class countdown. Follows developer.android.com "Live Updates":
//   - ongoing, with a title, standard style, no custom views, not colorized, not a group summary, on a channel above IMPORTANCE_MIN;
//   - requests promotion (EXTRA_REQUEST_PROMOTED_ONGOING) and sets the chip's short text (EXTRA_SHORT_CRITICAL_TEXT) or a counting time;
//   - the manifest declares android.permission.POST_PROMOTED_NOTIFICATIONS (app.json).
// The two extras are set by their string names so this builds against any compile SDK; on Android versions without Live Updates the same
// notification simply shows as an ordinary ongoing one.
class ScLiveUpdateModule : Module() {
  private val channelId = "live_updates"

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  override fun definition() = ModuleDefinition {
    Name("ScLiveUpdate")

    Function("show") { o: Map<String, Any?> ->
      val id = (o["id"] as? Number)?.toInt() ?: 1
      val title = o["title"] as? String ?: ""
      val text = o["text"] as? String ?: ""
      val chip = o["chip"] as? String ?: ""
      val whenMs = (o["whenMs"] as? Number)?.toDouble() ?: 0.0
      val chronometer = o["chronometer"] as? Boolean ?: false
      val countDown = o["countDown"] as? Boolean ?: false
      val progress = (o["progress"] as? Number)?.toInt() ?: -1
      val uri = o["uri"] as? String ?: "sccoachingmobile://"
      val ctx = context
      val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(channelId) == null) {
        val channel = NotificationChannel(channelId, "Workout and class timers", NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = "A live timer while you train and before a class you've booked."
        channel.setSound(null, null)
        channel.enableVibration(false)
        manager.createNotificationChannel(channel)
      }

      val open = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      val contentIntent = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, channelId) else @Suppress("DEPRECATION") Notification.Builder(ctx)
      builder
        .setSmallIcon(smallIcon(ctx))
        .setContentTitle(title)
        .setContentText(text)
        .setContentIntent(contentIntent)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setCategory(Notification.CATEGORY_PROGRESS)
        .setVisibility(Notification.VISIBILITY_PUBLIC)

      if (whenMs > 0) {
        builder.setWhen(whenMs.toLong()).setShowWhen(true)
        if (chronometer) {
          builder.setUsesChronometer(true)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) builder.setChronometerCountDown(countDown)
        }
      }
      if (progress in 0..100) builder.setProgress(100, progress, false)

      val extras = Bundle()
      extras.putBoolean("android.requestPromotedOngoing", true)
      if (chip.isNotEmpty()) extras.putCharSequence("android.shortCriticalText", chip)
      builder.addExtras(extras)

      manager.notify(id, builder.build())
    }

    Function("dismiss") { id: Int ->
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.cancel(id)
    }
  }

  private fun smallIcon(ctx: Context): Int {
    val res = ctx.resources
    for (name in listOf("notification_icon", "ic_notification")) {
      val idRes = res.getIdentifier(name, "drawable", ctx.packageName)
      if (idRes != 0) return idRes
    }
    return ctx.applicationInfo.icon
  }
}
