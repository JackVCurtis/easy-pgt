package expo.modules.bleperipheral

import android.util.Base64
import org.json.JSONException
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.UUID

data class HandshakeEnvelope(
  val version: Int,
  val messageType: String,
  val sessionId: String,
  val payloadBase64: String,
)

object HandshakeMessageCodec {
  const val MAX_MESSAGE_BYTES = 512

  fun decodeFromBytes(bytes: ByteArray): HandshakeEnvelope {
    if (bytes.isEmpty()) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake message is empty")
    }
    if (bytes.size > MAX_MESSAGE_BYTES) {
      throw BlePeripheralException("ERR_HANDSHAKE_TOO_LARGE", "Handshake message exceeds ${MAX_MESSAGE_BYTES} bytes")
    }

    val json = try {
      JSONObject(String(bytes, StandardCharsets.UTF_8))
    } catch (_: JSONException) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake message must be valid JSON")
    }

    val version = json.optInt("version", -1)
    val messageType = json.optString("messageType", "")
    val sessionId = json.optString("sessionId", "")
    val payload = json.optString("payload", "")

    if (version <= 0) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake version must be a positive integer")
    }
    if (messageType.isBlank()) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake messageType is required")
    }
    if (!isValidUuid(sessionId)) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake sessionId must be a UUID")
    }
    if (payload.isBlank()) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake payload is required")
    }
    decodePayload(payload)

    return HandshakeEnvelope(version, messageType, sessionId, payload)
  }

  fun decodeFromBase64(base64Payload: String): Pair<HandshakeEnvelope, ByteArray> {
    val decoded = try {
      Base64.decode(base64Payload, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
      throw BlePeripheralException("ERR_INVALID_BASE64", "Payload must be valid base64")
    }

    val envelope = decodeFromBytes(decoded)
    return Pair(envelope, decoded)
  }

  private fun decodePayload(payloadBase64: String): ByteArray {
    return try {
      Base64.decode(payloadBase64, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
      throw BlePeripheralException("ERR_MALFORMED_HANDSHAKE", "Handshake payload must be base64-encoded")
    }
  }

  private fun isValidUuid(value: String): Boolean {
    return try {
      UUID.fromString(value)
      true
    } catch (_: IllegalArgumentException) {
      false
    }
  }
}
