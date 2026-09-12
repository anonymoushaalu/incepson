// Pixel-accurate mirror of firmware/agentpay_device/agentpay_device.ino's
// four screen states. SSD1306 is 128x64; Adafruit_GFX text size 1 is a 6x8px
// monospace cell (5x7 glyph + 1px spacing), which is what every display.print
// call in the firmware actually uses (setTextSize(1) throughout). Reproduced
// here at 4x scale (512x256 CSS px) so it's legible without a camera on the
// breadboard.
const SCALE = 4;
const CHAR_H = 8;
const COLS = 21; // 128 / 6, matches the real display's usable width
const ROWS = 8; // 64 / 8

function OledScreen({ lines }: { lines: string[] }) {
  const padded = Array.from({ length: ROWS }, (_, i) => (lines[i] ?? "").slice(0, COLS));
  return (
    <div
      className="border-4 border-slate-700 bg-black p-2"
      style={{ width: 128 * SCALE + 16, imageRendering: "pixelated" }}
    >
      <pre
        className="whitespace-pre text-white"
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: CHAR_H * SCALE * 0.82,
          lineHeight: `${CHAR_H * SCALE}px`,
          letterSpacing: `${SCALE * 0.5}px`,
        }}
      >
        {padded.join("\n")}
      </pre>
    </div>
  );
}

export type OledState =
  | { kind: "idle" }
  | { kind: "tampered" }
  | { kind: "intent"; service: string; amount: string; reason: string }
  | { kind: "approved" }
  | { kind: "rejected"; httpCode: number };

export function OledMirror({ state }: { state: OledState }) {
  const lines = (() => {
    switch (state.kind) {
      case "idle":
        return ["AgentPay", "Waiting for a request..."];
      case "tampered":
        return ["!! TAMPERED !!", "Signature mismatch.", "Button disarmed."];
      case "intent":
        return [
          "APPROVE PAYMENT?",
          `Service: ${state.service}`,
          `Amount:  ${state.amount} HBAR`,
          `Reason:  ${state.reason}`,
          "Press button to approve",
        ];
      case "approved":
        return ["Approved.", "Settling on Hedera..."];
      case "rejected":
        return ["Approval rejected.", `HTTP ${state.httpCode}`];
    }
  })();

  return <OledScreen lines={lines} />;
}
