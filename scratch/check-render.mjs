const RENDER_API_KEY = "rnd_0WqWxkJD6Tyn7OpGOJbZXPkn8JWY";

async function checkRender() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  try {
    console.log("Checking Render owners...");
    const ownersRes = await fetch("https://api.render.com/v1/owners", { headers });
    const owners = await ownersRes.json();
    console.log("Owners response:", JSON.stringify(owners, null, 2));

    console.log("Checking Render existing services...");
    const servicesRes = await fetch("https://api.render.com/v1/services?limit=20", { headers });
    const services = await servicesRes.json();
    console.log("Existing services:", JSON.stringify(services, null, 2));
  } catch (err) {
    console.error("Render check error:", err);
  }
}

checkRender();
