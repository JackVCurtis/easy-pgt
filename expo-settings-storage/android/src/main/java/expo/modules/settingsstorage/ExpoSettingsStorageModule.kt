package expo.modules.settingsstorage

import android.os.Build
import android.util.Base64
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.content.Context
import android.content.SharedPreferences

class ExpoSettingsStorageModule : Module() {
  companion object {
    private const val MODULE_NAME = "ExpoSettingsStorage"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "expo_settings_storage_key_v1"
    private const val PREFS_NAME = "expo_settings_storage"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_SIZE_BYTES = 12
    private const val TAG_SIZE_BITS = 128
  }

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("setItem") { key: String, value: String ->
      ensureApiLevel()
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
      val ciphertext = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
      val payload = encode(cipher.iv, ciphertext)
      prefs().edit().putString(key, payload).apply()
    }

    AsyncFunction("getItem") { key: String, promise: Promise ->
      try {
        ensureApiLevel()

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
            "ERR_ACTIVITY_TYPE",
            "Current activity does not support biometric prompts",
            null
          )
          return@AsyncFunction
        }

        val (iv, ciphertext) = decode(payload)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val secretKey = getOrCreateSecretKey()
        val spec = GCMParameterSpec(TAG_SIZE_BITS, iv)

        val executor = ContextCompat.getMainExecutor(fragmentActivity)
        val prompt = BiometricPrompt(
          fragmentActivity,
          executor,
          object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
              promise.reject("ERR_AUTH", errString.toString(), null)
            }

            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
              try {
                val cryptoObject = result.cryptoObject
                val authenticatedCipher = cryptoObject?.cipher
                  ?: throw IllegalStateException("Missing cipher from authentication result")
                val plaintextBytes = authenticatedCipher.doFinal(ciphertext)
                val plaintext = String(plaintextBytes, StandardCharsets.UTF_8)
                promise.resolve(plaintext)
              } catch (e: Exception) {
                promise.reject("ERR_DECRYPT", "Failed to decrypt value", e)
              }
            }

            override fun onAuthenticationFailed() {
              // Let the system continue; no reject here.
            }
          }
        )

        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
          .setTitle("Unlock secure settings")
          .setSubtitle("Use biometrics or screen lock")
          .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
          .build()

        prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
      } catch (e: Exception) {
        promise.reject("ERR_GET_ITEM", "Failed to load protected value", e)
      }
    }

    AsyncFunction("deleteItem") { key: String ->
      prefs().edit().remove(key).apply()
    }
  }

  private fun ensureApiLevel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      throw IllegalStateException("This minimal implementation requires Android 11+ (API 30+)")
    }
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

    val spec = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .setUserAuthenticationRequired(true)
      .setUserAuthenticationParameters(
        0,
        KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
      )
      .build()

    keyGenerator.init(spec)
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
