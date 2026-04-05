const SERVICE_UUID = process.env.REACT_APP_BLE_SERVICE_UUID;
const CHAR_UUID    = process.env.REACT_APP_BLE_CHAR_UUID;

export async function scanBLE() {
  if (!navigator.bluetooth) {
    return { available: false, reason: "Web Bluetooth not supported in this browser" };
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID]
    });

    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const char    = await service.getCharacteristic(CHAR_UUID);
    const value   = await char.readValue();

    const text    = new TextDecoder().decode(value);
    const payload = JSON.parse(text);

    device.gatt.disconnect();

    return {
      available: true,
      deviceId:  payload.deviceId,
      timestamp: payload.timestamp,
      hmac:      payload.hmac,
    };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}
