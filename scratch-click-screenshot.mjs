import { launch } from "chrome-launcher";
import fs from "node:fs";

const url = process.argv[2];
const outPath = process.argv[3];
const buttonText = process.argv[4];
const captureDelayMs = Number(process.argv[5] || 800);
const initialWaitMs = Number(process.argv[6] || 3000);

const chrome = await launch({
  chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox", "--window-size=1440,960"],
});

function send(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const handler = (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

let idCounter = 100;
function nextId() { return idCounter++; }

try {
  const res = await fetch(`http://localhost:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  await send(ws, nextId(), "Page.enable");
  await send(ws, nextId(), "Runtime.enable");
  await send(ws, nextId(), "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, initialWaitMs));

  await send(ws, nextId(), "Runtime.evaluate", {
    expression: `
      (function() {
        var btns = Array.from(document.querySelectorAll('button'));
        var target = btns.find(b => b.textContent.trim() === ${JSON.stringify(buttonText)});
        if (!target) return 'NOT_FOUND';
        target.click();
        return 'clicked: ' + target.textContent;
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, captureDelayMs));

  const { data } = await send(ws, nextId(), "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  ws.close();
  console.log("saved", outPath);
} finally {
  await chrome.kill();
}
