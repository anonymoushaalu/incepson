// Compile and run THIS before touching agentpay_device.ino. It proves
// mbedtls/md.h works in your specific Arduino-ESP32 core version and that
// its HMAC-SHA256 output matches Node's crypto.createHmac exactly.
//
// Cross-check (already run and verified on the dev machine building this):
//   node -e "console.log(require('crypto').createHmac('sha256','test-secret').update('hello').digest('hex'))"
// => bcc889a40667cab715e1dc22ad280692cf4bf1c3a280eeeca60d8dbcd8e4b993
// The Serial Monitor output below must match this exactly.

#include <mbedtls/md.h>

void setup() {
  Serial.begin(115200);
  delay(1500);

  const char *secret = "test-secret";
  const char *message = "hello";

  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  int setupResult = mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  if (setupResult != 0) {
    Serial.printf("mbedtls_md_setup failed: %d\n", setupResult);
    return;
  }
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)secret, strlen(secret));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)message, strlen(message));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", hmacResult[i]);
  hex[64] = '\0';

  Serial.println("mbedtls/md.h compiled and ran successfully.");
  Serial.print("HMAC-SHA256(\"test-secret\", \"hello\") = ");
  Serial.println(hex);
  Serial.println("Compare this to the node crypto command in the comment above.");
}

void loop() {}
