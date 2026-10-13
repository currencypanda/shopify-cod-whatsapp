import { spawn } from "child_process";
import http from "http";

async function checkPort() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:9222/json/version", (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const profileDir = "C:\\Users\\Ahmed\\.chrome-shopify-profile";
  
  console.log("Launching Chrome with remote debugging on port 9222...");
  const child = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const active = await checkPort();
    if (active) {
      console.log("Chrome CDP is ACTIVE on http://localhost:9222!");
      return;
    }
  }
  console.log("Chrome CDP failed to start within 5 seconds.");
}

main().catch(console.error);
