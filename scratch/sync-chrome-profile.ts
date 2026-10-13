import fs from "fs";
import path from "path";

const srcUserData = "C:\\Users\\Ahmed\\AppData\\Local\\Google\\Chrome\\User Data";
const destUserData = "C:\\Users\\Ahmed\\.chrome-shopify-profile";

function copyFileSafe(src: string, dest: string) {
  try {
    if (fs.existsSync(src)) {
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`Copied ${path.basename(src)}`);
    }
  } catch (err: any) {
    console.warn(`Could not copy ${src}:`, err.message);
  }
}

async function main() {
  // 1. Copy Local State (contains DPAPI-encrypted AES key)
  copyFileSafe(path.join(srcUserData, "Local State"), path.join(destUserData, "Local State"));

  // 2. Copy Default/Network/Cookies
  copyFileSafe(
    path.join(srcUserData, "Default", "Network", "Cookies"),
    path.join(destUserData, "Default", "Network", "Cookies")
  );

  // 3. Copy Default/Preferences
  copyFileSafe(
    path.join(srcUserData, "Default", "Preferences"),
    path.join(destUserData, "Default", "Preferences")
  );

  console.log("Cookie profile sync completed!");
}

main().catch(console.error);
