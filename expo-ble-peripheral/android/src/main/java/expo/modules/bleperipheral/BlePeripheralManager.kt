package expo.modules.bleperipheral

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import androidx.core.app.ActivityCompat
import expo.modules.kotlin.AppContext
import java.util.Collections
import java.util.UUID

class BlePeripheralException(val code: String, override val message: String) : Exception(message)

data class StartPeripheralOptions(
  val serviceUuid: UUID,
  val inboundCharacteristicUuid: UUID,
  val outboundCharacteristicUuid: UUID,
  val deviceName: String?,
  val advertiseMode: Int,
  val txPowerLevel: Int,
  val includeDeviceName: Boolean,
)

class BlePeripheralManager(
  private val context: Context,
  private val appContext: AppContext,
  private val listener: Listener,
) {
  interface Listener {
    fun onPeripheralStateChanged(state: Map<String, Any>)
    fun onAdvertisingStateChanged(advertising: Boolean)
    fun onDeviceConnected(address: String)
    fun onDeviceDisconnected(address: String)
    fun onHandshakeMessageReceived(base64Payload: String, envelope: HandshakeEnvelope)
    fun onError(code: String, message: String)
  }

  private val bluetoothManager: BluetoothManager? = context.getSystemService(BluetoothManager::class.java)
  private val bluetoothAdapter: BluetoothAdapter? get() = bluetoothManager?.adapter
  private val connectedDevices = Collections.synchronizedSet(mutableSetOf<String>())
  private val subscribedDevices = Collections.synchronizedSet(mutableSetOf<String>())

  private var gattServer: BluetoothGattServer? = null
  private var advertiser: BluetoothLeAdvertiser? = null
  private var advertiseCallback: AdvertiseCallback? = null
  private var outboundCharacteristic: BluetoothGattCharacteristic? = null
  private var inboundCharacteristic: BluetoothGattCharacteristic? = null
  private var serviceUuid: UUID? = null
  private var advertising = false
  private var gattServerStarted = false
  private var sessionReady = false

  fun isSupported(): Map<String, Boolean> {
    val adapter = bluetoothAdapter
    return mapOf(
      "bluetooth" to (adapter != null),
      "ble" to context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE),
      "peripheralMode" to (adapter?.isMultipleAdvertisementSupported == true),
      "multipleAdvertisement" to (adapter?.isMultipleAdvertisementSupported == true),
    )
  }

  fun requestPermissions(): Map<String, Boolean> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return mapOf("advertise" to true, "connect" to true)
    }

    val activity = appContext.currentActivity
    if (activity != null) {
      ActivityCompat.requestPermissions(
        activity,
        arrayOf(Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT),
        48123,
      )
    }

    return mapOf(
      "advertise" to hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE),
      "connect" to hasPermission(Manifest.permission.BLUETOOTH_CONNECT),
    )
  }

  fun startPeripheral(options: StartPeripheralOptions) {
    validateSupport()
    validatePermissions()
    stopPeripheral()

    serviceUuid = options.serviceUuid
    options.deviceName?.let { bluetoothAdapter?.name = it }

    val server = bluetoothManager?.openGattServer(context, gattServerCallback)
      ?: throw BlePeripheralException("ERR_GATT_SERVER_START_FAILED", "Unable to open GATT server")

    gattServer = server
    configureGattServer(server, options)
    gattServerStarted = true

    startAdvertising(options)
    emitState()
  }

  fun stopPeripheral() {
    advertiseCallback?.let { callback ->
      advertiser?.stopAdvertising(callback)
    }
    advertiseCallback = null
    advertising = false

    subscribedDevices.clear()
    connectedDevices.clear()
    outboundCharacteristic = null
    inboundCharacteristic = null
    serviceUuid = null
    sessionReady = false

    gattServer?.close()
    gattServer = null
    gattServerStarted = false

    emitState()
  }

  fun sendHandshakeMessage(base64Payload: String) {
    validatePermissions()
    val (_, encodedBytes) = HandshakeMessageCodec.decodeFromBase64(base64Payload)

    val characteristic = outboundCharacteristic
      ?: throw BlePeripheralException("ERR_NOTIFY_NOT_READY", "Outbound characteristic is unavailable")
    val server = gattServer
      ?: throw BlePeripheralException("ERR_GATT_SERVER_NOT_STARTED", "GATT server is not started")

    if (subscribedDevices.isEmpty()) {
      throw BlePeripheralException("ERR_NOTIFY_NOT_SUBSCRIBED", "No subscribed devices for notifications")
    }

    characteristic.value = encodedBytes
    connectedDevices.forEach { address ->
      val device = bluetoothAdapter?.getRemoteDevice(address) ?: return@forEach
      if (!subscribedDevices.contains(address)) {
        return@forEach
      }
      @Suppress("DEPRECATION")
      server.notifyCharacteristicChanged(device, characteristic, false)
    }
  }

  fun getState(): Map<String, Any> {
    val support = isSupported()
    val permissionsGranted = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      true
    } else {
      hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE) && hasPermission(Manifest.permission.BLUETOOTH_CONNECT)
    }

    return mapOf(
      "supported" to (support["bluetooth"] == true && support["ble"] == true && support["multipleAdvertisement"] == true),
      "permissionsGranted" to permissionsGranted,
      "advertising" to advertising,
      "gattServerStarted" to gattServerStarted,
      "connectedDeviceCount" to connectedDevices.size,
      "subscribedDeviceCount" to subscribedDevices.size,
      "sessionReady" to sessionReady,
    )
  }

  private fun configureGattServer(server: BluetoothGattServer, options: StartPeripheralOptions) {
    val service = BluetoothGattService(options.serviceUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY)

    inboundCharacteristic = BluetoothGattCharacteristic(
      options.inboundCharacteristicUuid,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )

    outboundCharacteristic = BluetoothGattCharacteristic(
      options.outboundCharacteristicUuid,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      BluetoothGattCharacteristic.PERMISSION_READ,
    ).apply {
      addDescriptor(
        BluetoothGattDescriptor(
          CCCD_UUID,
          BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
        ),
      )
    }

    service.addCharacteristic(inboundCharacteristic)
    service.addCharacteristic(outboundCharacteristic)

    val added = server.addService(service)
    if (!added) {
      throw BlePeripheralException("ERR_GATT_SERVER_START_FAILED", "Failed to register GATT service")
    }
  }

  private fun startAdvertising(options: StartPeripheralOptions) {
    val adapter = bluetoothAdapter ?: throw BlePeripheralException("ERR_BLUETOOTH_UNAVAILABLE", "Bluetooth adapter unavailable")
    val bleAdvertiser = adapter.bluetoothLeAdvertiser
      ?: throw BlePeripheralException("ERR_ADVERTISING_UNSUPPORTED", "BLE advertising not supported")

    advertiser = bleAdvertiser

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(options.advertiseMode)
      .setTxPowerLevel(options.txPowerLevel)
      .setConnectable(true)
      .build()

    val data = AdvertiseData.Builder()
      .setIncludeDeviceName(options.includeDeviceName)
      .addServiceUuid(ParcelUuid(options.serviceUuid))
      .build()

    advertiseCallback = object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
        advertising = true
        listener.onAdvertisingStateChanged(true)
        emitState()
      }

      override fun onStartFailure(errorCode: Int) {
        advertising = false
        listener.onAdvertisingStateChanged(false)
        listener.onError("ERR_ADVERTISING_START_FAILED", "Advertising failed with code: $errorCode")
        emitState()
      }
    }

    bleAdvertiser.startAdvertising(settings, data, advertiseCallback)
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      if (newState == BluetoothGatt.STATE_CONNECTED) {
        connectedDevices.add(device.address)
        listener.onDeviceConnected(device.address)
      } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
        connectedDevices.remove(device.address)
        subscribedDevices.remove(device.address)
        sessionReady = false
        listener.onDeviceDisconnected(device.address)
      }
      emitState()
    }

    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      val server = gattServer ?: return
      if (characteristic.uuid != inboundCharacteristic?.uuid) {
        if (responseNeeded) {
          server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        }
        return
      }

      try {
        val envelope = HandshakeMessageCodec.decodeFromBytes(value)
        sessionReady = envelope.messageType == "client-confirm"
        val base64Payload = android.util.Base64.encodeToString(value, android.util.Base64.NO_WRAP)
        listener.onHandshakeMessageReceived(base64Payload, envelope)
        if (responseNeeded) {
          server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }
      } catch (exception: BlePeripheralException) {
        if (responseNeeded) {
          server.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH, offset, null)
        }
        listener.onError(exception.code, exception.message)
      } finally {
        emitState()
      }
    }

    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      if (descriptor.uuid == CCCD_UUID) {
        val isEnabling = value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
        if (isEnabling) {
          subscribedDevices.add(device.address)
        } else {
          subscribedDevices.remove(device.address)
        }
        if (responseNeeded) {
          gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }
        emitState()
        return
      }

      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
      }
    }
  }

  private fun validateSupport() {
    val support = isSupported()
    if (support["bluetooth"] != true) {
      throw BlePeripheralException("ERR_BLUETOOTH_UNAVAILABLE", "Bluetooth adapter unavailable")
    }
    if (support["ble"] != true) {
      throw BlePeripheralException("ERR_BLE_UNSUPPORTED", "BLE is unsupported on this device")
    }
    if (support["multipleAdvertisement"] != true) {
      throw BlePeripheralException("ERR_ADVERTISING_UNSUPPORTED", "BLE advertising unsupported")
    }
  }

  private fun validatePermissions() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return
    }

    val hasAdvertise = hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE)
    val hasConnect = hasPermission(Manifest.permission.BLUETOOTH_CONNECT)
    if (!hasAdvertise || !hasConnect) {
      throw BlePeripheralException("ERR_PERMISSIONS_MISSING", "Bluetooth advertise/connect permissions are required")
    }
  }

  private fun hasPermission(permission: String): Boolean {
    return ActivityCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
  }

  private fun emitState() {
    listener.onPeripheralStateChanged(getState())
  }

  companion object {
    private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  }
}
