import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223; // use dedicated port for exporter
const TEMP_PROFILE = "C:\\Users\\Ahmed\\.chrome-export-profile";

class SimpleCDP {
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
      } catch (e) {
        console.error("Message parse error:", e);
      }
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
    this.ws.close();
  }
}

async function exportSvgToPng() {
  console.log("Starting headless Chrome for SVG to PNG rendering...");
  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${TEMP_PROFILE}`,
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "about:blank",
  ]);

  // Wait for CDP port
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

  if (!wsUrl) {
    child.kill();
    throw new Error("Failed to connect to headless Chrome CDP");
  }

  const cdp = new SimpleCDP();
  await cdp.connect(wsUrl);

  const mockupsDir = path.resolve(process.cwd(), "store-listing", "mockups");
  const items = [
    { file: "app-icon-1200x1200.svg", out: "app-icon-1200x1200.png", width: 1200, height: 1200 },
    { file: "screen1-dashboard-roi.svg", out: "screen1-dashboard-roi.png", width: 1600, height: 1000 },
    { file: "screen2-whatsapp-interactive.svg", out: "screen2-whatsapp-interactive.png", width: 1600, height: 1000 },
    { file: "screen3-shopify-tags.svg", out: "screen3-shopify-tags.png", width: 1600, height: 1000 },
    { file: "screen4-auto-restock.svg", out: "screen4-auto-restock.png", width: 1600, height: 1000 },
    { file: "screen5-zero-code-setup.svg", out: "screen5-zero-code-setup.png", width: 1600, height: 1000 },
  ];

  // Create a target tab
  const newTarget = await cdp.send("Target.createTarget", { url: "about:blank" });
  const targetId = newTarget.targetId;

  // Connect to the page
  const pageWs = `ws://localhost:${PORT}/devtools/page/${targetId}`;
  const pageCdp = new SimpleCDP();
  await pageCdp.connect(pageWs);

  await pageCdp.send("Page.enable");

  for (const item of items) {
    const inputPath = path.join(mockupsDir, item.file);
    const outputPath = path.join(mockupsDir, item.out);
    const fileUrl = `file:///${inputPath.replace(/\\/g, "/")}`;

    console.log(`Rendering ${item.file} -> ${item.out} (${item.width}x${item.height})...`);

    // Set viewport
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width: item.width,
      height: item.height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await pageCdp.send("Page.navigate", { url: fileUrl });
    await new Promise((r) => setTimeout(r, 600));

    const screenshot = await pageCdp.send("Page.captureScreenshot", {
      format: "png",
      clip: {
        x: 0,
        y: 0,
        width: item.width,
        height: item.height,
        scale: 1,
      },
    });

    const buffer = Buffer.from(screenshot.data, "base64");
    fs.writeFileSync(outputPath, buffer);
    console.log(`✔ Saved ${item.out} (${buffer.length} bytes)`);
  }

  pageCdp.close();
  cdp.close();
  child.kill();
  console.log("All visual assets exported to PNG successfully!");
}

exportSvgToPng().catch(console.error);
