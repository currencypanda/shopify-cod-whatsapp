import { spawn } from "child_process";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9226;
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

async function test(url: string) {
  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    url
  ]);

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

  const tabsRes = await fetch(`http://localhost:${PORT}/json/list`);
  const tabs = await tabsRes.json();
  const page = new CDPClient();
  await page.connect(tabs[0].webSocketDebuggerUrl);

  await page.send("Page.enable");
  await page.send("Runtime.enable");

  await new Promise((r) => setTimeout(r, 4000));

  const info = await page.send("Runtime.evaluate", {
    expression: "({ title: document.title, url: window.location.href })",
    returnByValue: true
  });
  console.log(`URL: ${url} -> Result:`, info?.result?.value);

  page.close();
  child.kill();
}

async function main() {
  await test("https://dev.shopify.com/dashboard/238849299/apps/431180972033/versions");
}

main().catch(console.error);
