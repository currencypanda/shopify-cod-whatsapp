async function main() {
  const res = await fetch("http://localhost:9222/json/list");
  const tabs = await res.json();
  console.log("Active Chrome Tabs:", tabs.map((t: any) => ({ id: t.id, title: t.title, url: t.url, ws: t.webSocketDebuggerUrl })));
}

main().catch(console.error);
