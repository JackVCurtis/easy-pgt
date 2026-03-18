package expo.modules.settingsstorage

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
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

  private sealed interface PendingAction {
    data class Get(val key: String) : PendingAction
    data class Set(val key: String, val value: String) : PendingAction
  }

  private data class PendingRequest(
    val promise: Promise,
    val action: PendingAction,
    val hasRetriedAuth: Boolean = false
  )

  private var pendingRequest: PendingRequest? = null
  private var authHelper: DeviceAuthHelper? = null
  private var promptOnlyPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("setItem") { key: String, value: String, promise: Promise ->
      val action = PendingAction.Set(key, value)
      beginAuthenticatedRequest(action, promise)
    }

    AsyncFunction("getItem") { key: String, promise: Promise ->
      val payload = prefs().getString(key, null)
      if (payload == null) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val action = PendingAction.Get(key)
      beginAuthenticatedRequest(action, promise)
    }

    AsyncFunction("deleteItem") { key: String ->
      prefs().edit().remove(key).apply()
    }

    AsyncFunction("authenticate") { promise: Promise ->
      launchStandaloneAuthentication(promise)
    }

    OnActivityResult { _, payload ->
      val intent = payload.data
      val handled =
        authHelper?.onActivityResult(payload.requestCode, payload.resultCode) ?: false

      if (handled) null else intent
    }
  }

  private fun finishPendingRequest() {
    val pending = pendingRequest ?: return
    var shouldClear = true

    try {
      when (val action = pending.action) {
        is PendingAction.Set -> {
          val cipher = Cipher.getInstance(TRANSFORMATION)
          cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())

          val ciphertext = cipher.doFinal(action.value.toByteArray(StandardCharsets.UTF_8))
          val payload = encode(cipher.iv, ciphertext)

          prefs().edit().putString(action.key, payload).apply()
          pending.promise.resolve(null)
        }

        is PendingAction.Get -> {
          val payload = prefs().getString(action.key, null)
          if (payload == null) {
            pending.promise.resolve(null)
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
          pending.promise.resolve(String(plaintextBytes, StandardCharsets.UTF_8))
        }
      }
    } catch (e: android.security.keystore.UserNotAuthenticatedException) {
      if (!pending.hasRetriedAuth) {
        pendingRequest = pending.copy(hasRetriedAuth = true)
        shouldClear = false
        launchAuthentication()
        return
      }

      pending.promise.reject("ERR_AUTH", "User authentication timed out before accessing secure storage", e)
    } catch (e: AEADBadTagException) {
      pending.promise.reject("ERR_DECRYPT", "Stored value could not be authenticated", e)
    } catch (e: Exception) {
      pending.promise.reject("ERR_DECRYPT", "Failed to access secure storage", e)
    } finally {
      if (shouldClear) {
        clearPending()
      }
    }
  }

  private fun beginAuthenticatedRequest(action: PendingAction, promise: Promise) {
    if (pendingRequest != null) {
      promise.reject("ERR_BUSY", "Another secure storage operation is already in progress", null)
      return
    }

    pendingRequest = PendingRequest(promise = promise, action = action)
    launchAuthentication()
  }

  private fun launchAuthentication() {
    val pending = pendingRequest ?: return
    val activity = appContext.currentActivity
    if (activity == null) {
      pending.promise.reject("ERR_NO_ACTIVITY", "No foreground activity available", null)
      clearPending()
      return
    }

    val fragmentActivity = activity as? FragmentActivity
    if (fragmentActivity == null) {
      pending.promise.reject(
        "ERR_ACTIVITY",
        "Current activity must be a FragmentActivity to show BiometricPrompt",
        null
      )
      clearPending()
      return
    }

    fragmentActivity.runOnUiThread {
      try {
        authHelper = DeviceAuthHelper(
          activity = fragmentActivity,
          onSuccess = { finishPendingRequest() },
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

  private fun launchStandaloneAuthentication(promise: Promise) {
    if (pendingRequest != null || promptOnlyPromise != null) {
      promise.reject("ERR_BUSY", "Another secure storage operation is already in progress", null)
      return
    }

    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("ERR_NO_ACTIVITY", "No foreground activity available", null)
      return
    }

    val fragmentActivity = activity as? FragmentActivity
    if (fragmentActivity == null) {
      promise.reject(
        "ERR_ACTIVITY",
        "Current activity must be a FragmentActivity to show BiometricPrompt",
        null
      )
      return
    }

    promptOnlyPromise = promise
    fragmentActivity.runOnUiThread {
      try {
        authHelper = DeviceAuthHelper(
          activity = fragmentActivity,
          onSuccess = {
            promptOnlyPromise?.resolve(mapOf("status" to "success"))
            clearPromptOnly()
          },
          onError = { message ->
            val normalizedStatus =
              if (message.contains("cancel", ignoreCase = true) ||
                message.contains("declined", ignoreCase = true) ||
                message.contains("dismiss", ignoreCase = true)
              ) {
                "canceled"
              } else {
                "failed"
              }
            promptOnlyPromise?.resolve(
              mapOf(
                "status" to normalizedStatus,
                "message" to message
              )
            )
            clearPromptOnly()
          }
        )

        val launched = authHelper!!.authenticate(force = true)
        if (!launched) {
          promptOnlyPromise?.resolve(
            mapOf(
              "status" to "failed",
              "message" to "Unable to launch authentication"
            )
          )
          clearPromptOnly()
        }
      } catch (e: Exception) {
        promptOnlyPromise?.resolve(
          mapOf(
            "status" to "failed",
            "message" to "Failed to start authentication: ${e.message}"
          )
        )
        clearPromptOnly()
      }
    }
  }

  private fun rejectPending(code: String, message: String) {
    pendingRequest?.promise?.reject(code, message, null)
    clearPending()
  }

  private fun clearPending() {
    pendingRequest = null
    authHelper = null
  }

  private fun clearPromptOnly() {
    promptOnlyPromise = null
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
