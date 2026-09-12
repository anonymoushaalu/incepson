// AgentPay authorization oracle. Displays a server-signed payment intent and
// arms a physical button to approve exactly that intent -- nothing else.
//
// This device holds NO Hedera key material and can never move funds itself.
// It verifies an HMAC locally (refusing to arm on mismatch) and, on a press,
// returns intent_id + a fresh nonce + the same HMAC so the backend can prove
// the approval matches a pending, unexpired, unconsumed intent it created.
//
// UNVERIFIED until compiled against your actual Arduino-ESP32 core version:
// mbedtls/md.h below is the ESP-IDF-bundled mbedTLS's stable public API and
// should be present, but the blueprint explicitly calls this out as a risk.
// Compile the bare HMAC sketch (bottom of this file's comments) FIRST.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <mbedtls/md.h>
#include "secrets.h" // WIFI_SSID, WIFI_PASS, BACKEND_HOST, DEVICE_HMAC_SECRET

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define BUTTON_PIN 4 // change to match your wiring; INPUT_PULLUP, active LOW

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

const unsigned long POLL_INTERVAL_MS = 2000;
unsigned long lastPoll = 0;

// State for the currently displayed (and HMAC-verified) intent.
bool hasArmedIntent = false;
bool tampered = false;
String intentId, service, recipient, amount, reason, expiresAt, serverHmac;

// --- HMAC-SHA256 over the exact canonical string the backend signs ---
// intent_id|service|recipient|amount|reason|expires_at
// `amount` must already be the server's 8-decimal string, taken verbatim
// from the JSON field -- do not reformat it on-device, or the digest will
// not match the server's, even for numerically-equal values.
String hmacSha256Hex(const String &canonical, const char *secret) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t mdType = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(mdType), 1 /* use hmac */);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)secret, strlen(secret));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)canonical.c_str(), canonical.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", hmacResult[i]);
  hex[64] = '\0';
  return String(hex);
}

String canonicalize(const String &id, const String &svc, const String &rcpt,
                     const String &amt, const String &rsn, const String &exp) {
  String out;
  out.reserve(id.length() + svc.length() + rcpt.length() + amt.length() + rsn.length() + exp.length() + 5);
  out += id; out += '|'; out += svc; out += '|'; out += rcpt; out += '|';
  out += amt; out += '|'; out += rsn; out += '|'; out += exp;
  return out;
}

String genNonce() {
  char buf[33];
  for (int i = 0; i < 32; i++) sprintf(buf + i, "%x", (unsigned int)esp_random() & 0xF);
  buf[32] = '\0';
  return String(buf);
}

void showIdle() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("AgentPay");
  display.println("Waiting for a request...");
  display.display();
}

void showTampered() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("!! TAMPERED !!");
  display.println("Signature mismatch.");
  display.println("Button disarmed.");
  display.display();
}

void showIntent() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("APPROVE PAYMENT?");
  display.print("Service: "); display.println(service);
  display.print("Amount:  "); display.print(amount); display.println(" HBAR");
  display.print("Reason:  "); display.println(reason);
  display.println("Press button to approve");
  display.display();
}

void pollPending() {
  HTTPClient http;
  http.begin(String(BACKEND_HOST) + "/device/pending");
  int code = http.GET();

  if (code == 204) {
    http.end();
    if (hasArmedIntent || tampered) {
      hasArmedIntent = false;
      tampered = false;
      showIdle();
    }
    return;
  }

  if (code != 200) {
    http.end();
    return;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) return;

  String newIntentId = doc["intent_id"].as<String>();
  if (hasArmedIntent && newIntentId == intentId) return; // already showing this one

  intentId = newIntentId;
  service = doc["service"].as<String>();
  recipient = doc["recipient"].as<String>();
  // amount_hbar arrives as JSON number; re-serialize to the server's fixed
  // 8-decimal string so the canonical form matches byte-for-byte.
  double amountNum = doc["amount_hbar"].as<double>();
  char amountBuf[24];
  dtostrf(amountNum, 0, 8, amountBuf);
  amount = String(amountBuf);
  reason = doc["reason"].as<String>();
  expiresAt = doc["expires_at"].as<String>();
  serverHmac = doc["hmac"].as<String>();

  String canonical = canonicalize(intentId, service, recipient, amount, reason, expiresAt);
  String computedHmac = hmacSha256Hex(canonical, DEVICE_HMAC_SECRET);

  if (computedHmac != serverHmac) {
    tampered = true;
    hasArmedIntent = false;
    showTampered();
    return;
  }

  tampered = false;
  hasArmedIntent = true;
  showIntent();
}

void sendApproval() {
  if (!hasArmedIntent || tampered) return;

  String nonce = genNonce();

  HTTPClient http;
  http.begin(String(BACKEND_HOST) + "/device/approve");
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["intent_id"] = intentId;
  doc["nonce"] = nonce;
  doc["hmac"] = serverHmac;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  http.end();

  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  if (code == 200) {
    display.println("Approved.");
    display.println("Settling on Hedera...");
  } else {
    display.println("Approval rejected.");
    display.print("HTTP "); display.println(code);
  }
  display.display();

  hasArmedIntent = false;
  delay(2000);
  showIdle();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 init failed");
    for (;;) delay(1000);
  }
  display.clearDisplay();
  display.display();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Connecting WiFi...");
    display.display();
  }

  showIdle();
}

void loop() {
  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    if (WiFi.status() == WL_CONNECTED) pollPending();
  }

  // Active-LOW with INPUT_PULLUP: pressed reads LOW.
  static bool lastButtonState = HIGH;
  bool buttonState = digitalRead(BUTTON_PIN);
  if (buttonState == LOW && lastButtonState == HIGH) {
    sendApproval();
  }
  lastButtonState = buttonState;
}
