// api/shopify/webhooks/orders/create.js
import crypto from "crypto";

export default async function handler(req, res) {
  // Shopify always sends POST for webhooks
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // 1) Read raw body exactly as Shopify sent it
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }

  const hmacHeader = req.headers["x-shopify-hmac-sha256"];

  // Quick sanity logging (shows up in Vercel logs)
  console.log("=== Webhook received ===");
  console.log("Body length:", rawBody.length);
  console.log(
    "HMAC header prefix:",
    hmacHeader ? hmacHeader.slice(0, 10) + "..." : "MISSING"
  );
  console.log(
    "Secret prefix:",
    process.env.SHOPIFY_API_SECRET
      ? process.env.SHOPIFY_API_SECRET.slice(0, 8) + "..."
      : "MISSING"
  );

  if (!hmacHeader) {
    console.error("Missing HMAC header");
    return res.status(401).json({ ok: false, error: "Missing HMAC header" });
  }

  if (!process.env.SHOPIFY_API_SECRET) {
    console.error("Missing SHOPIFY_API_SECRET env");
    return res.status(500).json({ ok: false, error: "Missing app secret" });
  }

  // 2) Compute digest using the app secret from Shopify
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");

  console.log("Computed digest:", digest);
  console.log("Header HMAC    :", hmacHeader);

  const safeEqual =
    digest.length === hmacHeader.length &&
    crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));

  if (!safeEqual) {
    console.error("Invalid HMAC", { digest, hmacHeader });
    return res.status(401).json({ ok: false, error: "Invalid HMAC" });
  }

  // 3) HMAC is valid → process the webhook
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("Failed to parse webhook JSON", e);
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  console.log(
    `✅ Valid Shopify webhook orders/create for shop ${payload?.order?.name || "unknown"}`
  );

  // TODO: here you can forward to Base44 or store the order, etc.

  return res.status(200).json({ ok: true });
}
