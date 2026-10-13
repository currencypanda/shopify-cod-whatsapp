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
      } catch (e) {
        console.error("CDP Message error:", e);
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
    this.ws?.close();
  }
}

async function main() {
  console.log("================================================================================");
  console.log("    AUTOMATED SHOPIFY APP STORE LISTING FORM COMPLETION VIA BROWSER CDP         ");
  console.log("================================================================================");

  const targetUrl = "https://dev.shopify.com/dashboard/238849299/apps/431180972033/listing";
  console.log(`Target URL: ${targetUrl}`);

  // Launch visible Chrome instance with remote debugging
  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    targetUrl
  ], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  let wsUrl = "";
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`http://localhost:${PORT}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
  }

  if (!wsUrl) {
    throw new Error(`Failed to initialize Chrome CDP on port ${PORT}`);
  }

  console.log(`✔ CDP connected to browser on port ${PORT}`);

  // Get active tab
  let tabsRes = await fetch(`http://localhost:${PORT}/json/list`);
  let tabs = await tabsRes.json();
  let targetTab = tabs.find((t: any) => t.type === "page" && !t.url.startsWith("chrome-extension://"));

  if (!targetTab) {
    targetTab = tabs[0];
  }

  console.log(`Current page title: "${targetTab.title}", URL: "${targetTab.url}"`);

  const page = new CDPClient();
  await page.connect(targetTab.webSocketDebuggerUrl);

  await page.send("Page.enable");
  await page.send("DOM.enable");
  await page.send("Runtime.enable");

  // Read listing copy
  const appListingPath = path.resolve(process.cwd(), "store-listing", "APP_STORE_LISTING.md");
  const listingContent = fs.existsSync(appListingPath) ? fs.readFileSync(appListingPath, "utf-8") : "";

  const reviewNotesPath = path.resolve(process.cwd(), "docs", "SHOPIFY_REVIEW_INSTRUCTIONS.md");
  const reviewNotes = fs.existsSync(reviewNotesPath) ? fs.readFileSync(reviewNotesPath, "utf-8") : "";

  console.log(`Loaded listing markdown (${listingContent.length} chars) & reviewer notes (${reviewNotes.length} chars)`);

  // Monitor navigation loop: wait for user to reach the listing page if login is needed
  console.log("\nWaiting for listing page to finish loading (authenticating if necessary)...");
  let onListingPage = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const urlEval = await page.send("Runtime.evaluate", { expression: "window.location.href" });
    const curUrl = urlEval?.result?.value || "";
    
    if (curUrl.includes("/listing") && !curUrl.includes("accounts.shopify.com")) {
      console.log(`✔ Successfully reached listing page: ${curUrl}`);
      onListingPage = true;
      break;
    } else {
      if (attempt % 5 === 0) {
        console.log(`Current URL: ${curUrl} (waiting...)`);
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Allow DOM to settle
  await new Promise((r) => setTimeout(r, 3000));

  // Inspect page DOM elements
  const domInfo = await page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
          tag: el.tagName,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder,
          ariaLabel: el.getAttribute('aria-label'),
          type: el.type,
          value: el.value ? el.value.slice(0, 30) : ''
        }));
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
        return {
          title: document.title,
          url: window.location.href,
          inputCount: inputs.length,
          inputs: inputs.slice(0, 30),
          buttons: buttons.slice(0, 20)
        };
      })()
    `,
    returnByValue: true
  });

  console.log("\nPage DOM Inspection:", JSON.stringify(domInfo?.result?.value, null, 2));

  // Save initial screenshot
  const initialShot = await page.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.resolve(process.cwd(), "store-listing", "listing-initial-view.png"), Buffer.from(initialShot.data, "base64"));
  console.log("Saved store-listing/listing-initial-view.png");

  page.close();
}

main().catch(console.error);
