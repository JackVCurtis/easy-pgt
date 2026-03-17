package expo.modules.settingsstorage

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

class DeviceAuthHelper(
  private val activity: Activity,
  private val onSuccess: () -> Unit,
  private val onError: (String) -> Unit
) {
  companion object {
    const val REQUEST_CODE_CONFIRM_DEVICE_CREDENTIAL = 9417

    val BIOMETRIC_AUTHENTICATORS =
      BiometricManager.Authenticators.BIOMETRIC_STRONG or
      BiometricManager.Authenticators.BIOMETRIC_WEAK

    val ALLOWED_AUTHENTICATORS =
      BIOMETRIC_AUTHENTICATORS or
      BiometricManager.Authenticators.DEVICE_CREDENTIAL

    private val DISALLOWED_BIOMETRIC_VERSIONS = setOf(28, 29)
  }

  private val biometricManager = BiometricManager.from(activity)

  private fun keyguardManager(): KeyguardManager {
    return activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
  }

  private fun isDeviceSecure(): Boolean {
    return keyguardManager().isDeviceSecure
  }

  fun canAuthenticate(): Boolean {
    return if (Build.VERSION.SDK_INT >= 30) {
      biometricManager.canAuthenticate(ALLOWED_AUTHENTICATORS) ==
        BiometricManager.BIOMETRIC_SUCCESS
    } else {
      biometricManager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS ||
        isDeviceSecure()
    }
  }

  fun authenticate(force: Boolean = true): Boolean {
    if (!canAuthenticate()) {
      onError("Device authentication unavailable")
      return false
    }

    return if (
      Build.VERSION.SDK_INT >= 30 &&
      !DISALLOWED_BIOMETRIC_VERSIONS.contains(Build.VERSION.SDK_INT) &&
      biometricManager.canAuthenticate(ALLOWED_AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS
    ) {
      if (force) {
        val executor = ContextCompat.getMainExecutor(activity)
        val biometricPrompt = BiometricPrompt(
          activity,
          executor,
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              onError(errString.toString())
            }

            override fun onAuthenticationFailed() {
              // let system continue showing prompt
            }
          }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
          .setTitle("Unlock secure settings")
          .setSubtitle("Use biometrics or screen lock")
          .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
          .build()

        biometricPrompt.authenticate(promptInfo)
      }
      true
    } else {
      if (force) {
        val intent = keyguardManager().createConfirmDeviceCredentialIntent(
          "Unlock secure settings",
          ""
        )
        if (intent == null) {
          onError("Device credential prompt unavailable")
          return false
        }
        activity.startActivityForResult(intent, REQUEST_CODE_CONFIRM_DEVICE_CREDENTIAL)
      }
      true
    }
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
