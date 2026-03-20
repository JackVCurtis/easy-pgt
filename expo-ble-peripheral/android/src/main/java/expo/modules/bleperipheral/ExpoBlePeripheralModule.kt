package expo.modules.bleperipheral

import android.bluetooth.le.AdvertiseSettings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class ExpoBlePeripheralModule : Module() {
  private val manager by lazy {
    BlePeripheralManager(requireNotNull(appContext.reactContext), appContext, object : BlePeripheralManager.Listener {
      override fun onPeripheralStateChanged(state: Map<String, Any>) {
        sendEvent("onPeripheralStateChanged", state)
      }

      override fun onAdvertisingStateChanged(advertising: Boolean) {
        sendEvent("onAdvertisingStateChanged", mapOf("advertising" to advertising))
      }

      override fun onDeviceConnected(address: String) {
        sendEvent("onDeviceConnected", mapOf("deviceId" to address))
      }

      override fun onDeviceDisconnected(address: String) {
        sendEvent("onDeviceDisconnected", mapOf("deviceId" to address))
      }

      override fun onHandshakeMessageReceived(base64Payload: String, envelope: HandshakeEnvelope) {
        sendEvent("onHandshakeMessageReceived", mapOf(
          "base64Payload" to base64Payload,
          "version" to envelope.version,
          "messageType" to envelope.messageType,
          "sessionId" to envelope.sessionId,
        ))
      }

      override fun onError(code: String, message: String) {
        sendEvent("onError", mapOf("code" to code, "message" to message))
      }
    })
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoBlePeripheral")

    Events(
      "onPeripheralStateChanged",
      "onAdvertisingStateChanged",
      "onDeviceConnected",
      "onDeviceDisconnected",
      "onHandshakeMessageReceived",
      "onError",
    )

    AsyncFunction("isSupported") {
      manager.isSupported()
    }

    AsyncFunction("requestPermissions") {
      manager.requestPermissions()
    }

    AsyncFunction("startPeripheral") { options: Map<String, Any?> ->
      try {
        manager.startPeripheral(parseOptions(options))
      } catch (exception: BlePeripheralException) {
        throw Exception("${exception.code}: ${exception.message}")
      }
    }

    AsyncFunction("stopPeripheral") {
      manager.stopPeripheral()
    }

    AsyncFunction("sendHandshakeMessage") { base64Payload: String ->
      try {
        manager.sendHandshakeMessage(base64Payload)
      } catch (exception: BlePeripheralException) {
        throw Exception("${exception.code}: ${exception.message}")
      }
    }

    AsyncFunction("getState") {
      manager.getState()
    }

    OnDestroy {
      manager.stopPeripheral()
    }
  }

  private fun parseOptions(raw: Map<String, Any?>): StartPeripheralOptions {
    val serviceUuid = parseUuid(raw["serviceUuid"], "serviceUuid")
    val inboundUuid = parseUuid(raw["inboundCharacteristicUuid"], "inboundCharacteristicUuid")
    val outboundUuid = parseUuid(raw["outboundCharacteristicUuid"], "outboundCharacteristicUuid")

    val advertiseMode = when (raw["advertiseMode"] as? String ?: "balanced") {
      "balanced" -> AdvertiseSettings.ADVERTISE_MODE_BALANCED
      "lowLatency" -> AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
      "lowPower" -> AdvertiseSettings.ADVERTISE_MODE_LOW_POWER
      else -> throw BlePeripheralException("ERR_INVALID_OPTIONS", "Invalid advertiseMode")
    }

    val txPowerLevel = when (raw["txPowerLevel"] as? String ?: "medium") {
      "high" -> AdvertiseSettings.ADVERTISE_TX_POWER_HIGH
      "medium" -> AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM
      "low" -> AdvertiseSettings.ADVERTISE_TX_POWER_LOW
      "ultraLow" -> AdvertiseSettings.ADVERTISE_TX_POWER_ULTRA_LOW
      else -> throw BlePeripheralException("ERR_INVALID_OPTIONS", "Invalid txPowerLevel")
    }

    return StartPeripheralOptions(
      serviceUuid = serviceUuid,
      inboundCharacteristicUuid = inboundUuid,
      outboundCharacteristicUuid = outboundUuid,
      deviceName = raw["deviceName"] as? String,
      advertiseMode = advertiseMode,
      txPowerLevel = txPowerLevel,
      includeDeviceName = raw["includeDeviceName"] as? Boolean ?: false,
    )
  }

  private fun parseUuid(value: Any?, key: String): UUID {
    val input = value as? String ?: throw BlePeripheralException("ERR_INVALID_OPTIONS", "$key must be a UUID string")
    return try {
      UUID.fromString(input)
    } catch (_: IllegalArgumentException) {
      throw BlePeripheralException("ERR_INVALID_OPTIONS", "$key must be a valid UUID")
    }
  }
}
