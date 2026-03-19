package expo.modules.settingsstorage

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.biometric.BIOMETRIC_SUCCESS
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class DeviceAuthHelper(
  private val activity: FragmentActivity,
  private val onSuccess: () -> Unit,
  private val onError: (String) -> Unit
) {
  companion object {
    const val REQUEST_CODE_CONFIRM_DEVICE_CREDENTIAL = 9417

    // Match this to the keystore key auth policy.
    val ALLOWED_AUTHENTICATORS =
      BiometricManager.Authenticators.BIOMETRIC_STRONG or
      BiometricManager.Authenticators.DEVICE_CREDENTIAL
  }

  private val biometricManager = BiometricManager.from(activity)
  private val mainHandler = Handler(Looper.getMainLooper())

  private fun keyguardManager(): KeyguardManager {
    return activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
  }

  private fun isDeviceSecure(): Boolean {
    return keyguardManager().isDeviceSecure
  }

  fun canAuthenticate(): Boolean {
    return biometricManager.canAuthenticate(ALLOWED_AUTHENTICATORS) == BIOMETRIC_SUCCESS
  }

  fun authenticate(force: Boolean = true): Boolean {
    if (!canAuthenticate()) {
      onError("Device authentication unavailable")
      return false
    }

    if (!force) return true

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      mainHandler.post {
        try {
          val executor = ContextCompat.getMainExecutor(activity)
          val biometricPrompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
              override fun onAuthenticationSucceeded(
                result: BiometricPrompt.AuthenticationResult
              ) {
                onSuccess()
              }

              override fun onAuthenticationError(
                errorCode: Int,
                errString: CharSequence
              ) {
                onError(errString.toString())
              }

              override fun onAuthenticationFailed() {
                // Non-terminal failure; system keeps prompt open.
              }
            }
          )

          val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock secure settings")
            .setSubtitle("Use biometrics or screen lock")
            .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
            .build()

          biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
          onError("Failed to start biometric authentication: ${e.message}")
        }
      }
      return true
    }

    // Android 10 and lower fallback: confirm device credential directly.
    val intent = keyguardManager().createConfirmDeviceCredentialIntent(
      "Unlock secure settings",
      ""
    )
    if (intent == null) {
      onError("Device credential prompt unavailable")
      return false
    }

    activity.runOnUiThread {
      @Suppress("DEPRECATION")
      activity.startActivityForResult(intent, REQUEST_CODE_CONFIRM_DEVICE_CREDENTIAL)
    }
    return true
  }

  fun onActivityResult(requestCode: Int, resultCode: Int): Boolean {
    if (requestCode != REQUEST_CODE_CONFIRM_DEVICE_CREDENTIAL) return false

    if (resultCode == Activity.RESULT_OK) {
      onSuccess()
    } else {
      onError("Authentication cancelled")
    }
    return true
  }
}
