/*
  main.cpp
  ESP32 DevKitV1 — BLE Anti-Spoofing Witness
  All config lives in config.h
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <SHA256.h>
#include "config.h"

BLEServer*         pServer   = nullptr;
BLECharacteristic* pChar     = nullptr;
bool               connected = false;

String computeHMAC(const String& message, const String& secret) {
  SHA256 sha;
  uint8_t key[32];
  uint8_t result[32];

  memset(key, 0, sizeof(key));
  size_t keyLen = min((size_t)secret.length(), sizeof(key));
  memcpy(key, secret.c_str(), keyLen);

  sha.resetHMAC(key, keyLen);
  sha.update(message.c_str(), message.length());
  sha.finalizeHMAC(key, keyLen, result, sizeof(result));

  String hex = "";
  for (int i = 0; i < 32; i++) {
    if (result[i] < 16) hex += "0";
    hex += String(result[i], HEX);
  }
  return hex;
}

String buildPayload() {
  unsigned long ts = millis() / 1000;
  String message   = String(DEVICE_ID) + ":" + String(ts);
  String hmac      = computeHMAC(message, BLE_SECRET);

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"timestamp\":"  + String(ts)         + ",";
  payload += "\"hmac\":\""     + hmac               + "\"";
  payload += "}";
  return payload;
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s)    { connected = true;  Serial.println("Client connected"); }
  void onDisconnect(BLEServer* s) { connected = false; Serial.println("Client disconnected"); s->startAdvertising(); }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Geo-Private ESP32 starting...");

  BLEDevice::init(DEVICE_ID);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pChar = pService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pChar->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("BLE advertising started");
  Serial.print("Service UUID: "); Serial.println(SERVICE_UUID);
  Serial.print("Char UUID:    "); Serial.println(CHAR_UUID);
}

void loop() {
  String payload = buildPayload();
  pChar->setValue(payload.c_str());
  if (connected) pChar->notify();
  Serial.println("Payload: " + payload);
  delay(ADVERTISE_INTERVAL_MS);
}
