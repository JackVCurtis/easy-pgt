package expo.modules.settingsstorage

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class ExpoSettingsStorageModule : Module() {
  companion object {
    private const val MODULE_NAME = "ExpoSettingsStorage"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "expo_settings_storage_key_v2"
    private const val PREFS_NAME = "expo_settings_storage"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_SIZE_BYTES = 12
    private const val TAG_SIZE_BITS = 128
    private const val AUTH_VALIDITY_SECONDS = 30
  }

  private val mainHandler = Handler(Looper.getMainLooper())

  private var pendingGetPromise: Promise? = null
  private var pendingGetKey: String? = null
  private var authHelper: DeviceAuthHelper? = null

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("setItem") { key: String, value: String ->
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())

      val ciphertext = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
      val payload = encode(cipher.iv, ciphertext)

      prefs().edit().putString(key, payload).apply()
    }

    AsyncFunction("getItem") { key: String, promise: Promise ->
      val payload = prefs().getString(key, null)
      if (payload == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "No foreground activity available", null)
        return@AsyncFunction
      }

      val fragmentActivity = activity as? FragmentActivity
      if (fragmentActivity == null) {
        promise.reject(
          "ERR_ACTIVITY",
          "Current activity must be a FragmentActivity to show BiometricPrompt",
          null
        )
        return@AsyncFunction
      }

      if (pendingGetPromise != null) {
        promise.reject("ERR_BUSY", "Another secure read is already in progress", null)
        return@AsyncFunction
      }

      pendingGetPromise = promise
      pendingGetKey = key

      mainHandler.post {
        try {
          authHelper = DeviceAuthHelper(
            activity = fragmentActivity,
            onSuccess = { finishPendingDecrypt() },
            onError = { message -> rejectPending("ERR_AUTH", message) }
          )

          val launched = authHelper!!.authenticate(force = true)
          if (!launched) {
            rejectPending("ERR_AUTH", "Unable to launch authentication")
          }
        } catch (e: Exception) {
          rejectPending("ERR_AUTH", "Failed to start authentication: ${e.message}")
        }
      }
    }

    AsyncFunction("deleteItem") { key: String ->
      prefs().edit().remove(key).apply()
    }

    OnActivityResult { _, payload ->
      val intent = payload.data
      val handled =
        authHelper?.onActivityResult(payload.requestCode, payload.resultCode) ?: false

      if (handled) null else intent
    }
  }

  private fun finishPendingDecrypt() {
    val promise = pendingGetPromise ?: return
    val key = pendingGetKey ?: return

    try {
      val payload = prefs().getString(key, null)
      if (payload == null) {
        promise.resolve(null)
        clearPending()
        return
      }

      val (iv, ciphertext) = decode(payload)

      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(
        Cipher.DECRYPT_MODE,
        getOrCreateSecretKey(),
        GCMParameterSpec(TAG_SIZE_BITS, iv)
      )

      val plaintextBytes = cipher.doFinal(ciphertext)
      promise.resolve(String(plaintextBytes, StandardCharsets.UTF_8))
    } catch (e: android.security.keystore.UserNotAuthenticatedException) {
      promise.reject("ERR_AUTH", "User authentication timed out before decrypt", e)
    } catch (e: AEADBadTagException) {
      promise.reject("ERR_DECRYPT", "Stored value could not be authenticated", e)
    } catch (e: Exception) {
      promise.reject("ERR_DECRYPT", "Failed to decrypt value", e)
    } finally {
      clearPending()
    }
  }

  private fun rejectPending(code: String, message: String) {
    pendingGetPromise?.reject(code, message, null)
    clearPending()
  }

  private fun clearPending() {
    pendingGetPromise = null
    pendingGetKey = null
    authHelper = null
  }

  private fun prefs(): SharedPreferences {
    val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  private fun getOrCreateSecretKey(): SecretKey {
    val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
    val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
    if (existing != null) return existing

    val keyGenerator =
      KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)

    val builder = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(
        AUTH_VALIDITY_SECONDS,
        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
      )
    } else {
      @Suppress("DEPRECATION")
      builder.setUserAuthenticationValidityDurationSeconds(AUTH_VALIDITY_SECONDS)
    }

    keyGenerator.init(builder.build())
    return keyGenerator.generateKey()
  }

  private fun encode(iv: ByteArray, ciphertext: ByteArray): String {
    val ivB64 = Base64.encodeToString(iv, Base64.NO_WRAP)
    val ctB64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP)
    return "$ivB64:$ctB64"
  }

  private fun decode(payload: String): Pair<ByteArray, ByteArray> {
    val parts = payload.split(":")
    require(parts.size == 2) { "Invalid encrypted payload" }

    val iv = Base64.decode(parts[0], Base64.NO_WRAP)
    val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)

    require(iv.size == IV_SIZE_BYTES) { "Invalid IV length" }
    return iv to ciphertext
  }
}
