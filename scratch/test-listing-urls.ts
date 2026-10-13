import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9224;
const USER_DATA = "C:\\Users\\Ahmed\\.chrome-listing-automation";

class CDPClient {
  private ws!: WebSocket;
  private id = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  async connect(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        if (data.id && this.pending.has(data.id)) {
          const { resolve, reject } = this.pending.get(data.id)!;
          this.pending.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        }
      } catch (e) {}
    };
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function testUrl(cdp: CDPClient, targetUrl: string, name: string) {
  console.log(`\nNavigating to: ${targetUrl}...`);
  await cdp.send("Page.navigate", { url: targetUrl });
  await new Promise((r) => setTimeout(r, 6000));

  const info = await cdp.send("Runtime.evaluate", {
    expression: `
      (() => {
        return {
          title: document.title,
          url: window.location.href,
          text: document.body ? document.body.innerText.slice(0, 500) : ''
        };
      })()
    `,
    returnByValue: true
  });

  console.log(`${name} info:`, JSON.stringify(info?.result?.value, null, 2));

  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  const outPath = path.resolve(process.cwd(), "store-listing", `${name}.png`);
  fs.writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  console.log(`✔ Saved screenshot: ${outPath}`);
}

async function main() {
  console.log("Spawning Chrome for URL inspection...");
  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  let wsUrl = "";
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://localhost:${PORT}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
  }

  if (!wsUrl) throw new Error("Could not connect to Chrome CDP");

  const tabsRes = await fetch(`http://localhost:${PORT}/json/list`);
  const tabs = await tabsRes.json();
  const page = new CDPClient();
  await page.connect(tabs[0].webSocketDebuggerUrl);

  await page.send("Page.enable");
  await page.send("Runtime.enable");

  await testUrl(page, "https://dev.shopify.com/org/238849299/apps/431180972033/listing", "dev-org-listing");
  await testUrl(page, "https://partners.shopify.com/238849299/apps/431180972033/listing", "partners-listing");

  page.close();
  child.kill();
}

main().catch(console.error);
