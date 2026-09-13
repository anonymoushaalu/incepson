import { launch } from "chrome-launcher";
import fs from "node:fs";

const url = process.argv[2];
const outPath = process.argv[3];
const scrollToIndex = Number(process.argv[4] || 0);
const waitMs = Number(process.argv[5] || 2500);

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

try {
  const res = await fetch(`http://localhost:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  await send(ws, 1, "Page.enable");
  await send(ws, 2, "Runtime.enable");
  await send(ws, 3, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, waitMs));

  await send(ws, 4, "Runtime.evaluate", {
    expression: `
      (function() {
        var btns = document.querySelectorAll('nav button');
        var idx = ${scrollToIndex};
        var target = btns[idx + 1]; // +1 skips the AgentPay logo span (not a button, but keep offset safe)
        var navButtons = Array.from(document.querySelectorAll('nav button'));
        navButtons[idx].click();
        return navButtons[idx].textContent;
      })()
    `,
  });
  await new Promise((r) => setTimeout(r, 1200));

  const { data } = await send(ws, 5, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(outPath, Buffer.from(data, "base64"));
  ws.close();
  console.log("saved", outPath);
} finally {
  await chrome.kill();
}
