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
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const profileDir = "C:\\Users\\Ahmed\\.edge-shopify-profile";
  
  console.log("Launching Edge with remote debugging on port 9222...");
  const child = spawn(edgePath, [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "https://dev.shopify.com/dashboard/238849299/apps/431180972033/listing"
  ], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  // Wait up to 5 seconds for CDP
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const active = await checkPort();
    if (active) {
      console.log("CDP is ACTIVE on http://localhost:9222!");
      return;
    }
  }
  console.log("CDP failed to start within 5 seconds.");
}

main().catch(console.error);
