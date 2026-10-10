package expo.modules.sensitiveclipboard

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Copies text marked as sensitive. Android 13+ then shows a masked preview
 * instead of the copied password, and keyboards don't offer it as a
 * suggestion. Older versions ignore the flag and behave like a normal copy.
 */
class SensitiveClipboardModule : Module() {
  private val clipboard: ClipboardManager
    get() = (appContext.reactContext ?: throw Exceptions.ReactContextLost())
      .getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

  override fun definition() = ModuleDefinition {
    Name("SensitiveClipboard")

    AsyncFunction("setSensitiveStringAsync") { text: String ->
      val clip = ClipData.newPlainText("", text)
      clip.description.extras = PersistableBundle().apply {
        val key = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          ClipDescription.EXTRA_IS_SENSITIVE
        } else {
          "android.content.extra.IS_SENSITIVE"
        }
        putBoolean(key, true)
      }
      clipboard.setPrimaryClip(clip)
    }

    /** Empty the clipboard (no blank "copied" preview). */
    AsyncFunction("clearAsync") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        clipboard.clearPrimaryClip()
      } else {
        clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
      }
    }
  }
}
