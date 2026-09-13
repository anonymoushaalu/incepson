import { launch } from "chrome-launcher";

const url = process.argv[2];
const totalWaitMs = Number(process.argv[3] || 15000);

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

let idCounter = 200;
function nextId() { return idCounter++; }

try {
  const res = await fetch(`http://localhost:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.method === "Runtime.consoleAPICalled") {
      const args = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      console.log(`[console.${msg.params.type}]`, args);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("[exception]", JSON.stringify(msg.params.exceptionDetails));
    }
    if (msg.method === "Log.entryAdded") {
      console.log(`[log.${msg.params.entry.level}]`, msg.params.entry.text);
    }
  });

  await send(ws, nextId(), "Runtime.enable");
  await send(ws, nextId(), "Log.enable");
  await send(ws, nextId(), "Page.enable");
  await send(ws, nextId(), "Page.navigate", { url });

  await new Promise((r) => setTimeout(r, 3000));

  // Cycle through every nav section, dwelling briefly, to simulate real use.
  for (let i = 0; i < 7; i++) {
    await send(ws, nextId(), "Runtime.evaluate", {
      expression: `document.querySelectorAll('nav button')[${i}].click()`,
    });
    await new Promise((r) => setTimeout(r, 1200));
  }
  // back to Live Flow
  await send(ws, nextId(), "Runtime.evaluate", { expression: `document.querySelectorAll('nav button')[0].click()` });

  await new Promise((r) => setTimeout(r, Math.max(0, totalWaitMs - 3000 - 7 * 1200)));

  console.log("DONE watching");
  ws.close();
} finally {
  await chrome.kill();
}
