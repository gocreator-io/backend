// api/shopify/webhooks/orders/create.js
import crypto from "crypto";

export default async function handler(req, res) {
  // 1) Nur POST zulassen
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 2) Roh-Body einlesen (ohne vorheriges Parsing)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBodyBuffer = Buffer.concat(chunks);
    const rawBodyString = rawBodyBuffer.toString("utf8");

    // 3) Header + Secret holen
    const hmacHeader =
      req.headers["x-shopify-hmac-sha256"] ||
      req.headers["X-Shopify-Hmac-SHA256".toLowerCase()];

    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      console.error("Missing SHOPIFY_API_SECRET env var");
      return res.status(500).json({
        ok: false,
        error: "Server misconfigured: SHOPIFY_API_SECRET not set",
      });
    }

    // Debug-Logging (nur zum Testen)
    console.log("Webhook received 🌐");
    console.log("Body length:", rawBodyBuffer.length);
    console.log("HMAC header:", hmacHeader);

    // 4) HMAC berechnen (WICHTIG: mit Buffer, nicht mit JSON.stringify)
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBodyBuffer)
      .digest("base64");

    console.log("Computed digest:", digest);

    // 5) Timing-safe Vergleich
    if (!hmacHeader) {
      console.error("Missing X-Shopify-Hmac-SHA256 header");
      return res.status(401).json({ ok: false, error: "Missing HMAC header" });
    }

    const digestBuffer = Buffer.from(digest, "utf8");
    const headerBuffer = Buffer.from(hmacHeader, "utf8");

    // Längen angleichen, sonst wirft timingSafeEqual
    if (digestBuffer.length !== headerBuffer.length) {
      console.error("HMAC length mismatch");
      return res.status(401).json({ ok: false, error: "Invalid HMAC" });
    }

    const valid = crypto.timingSafeEqual(digestBuffer, headerBuffer);

    if (!valid) {
      console.error("❌ Invalid HMAC");
      return res.status(401).json({ ok: false, error: "Invalid HMAC" });
    }

    console.log("✅ HMAC valid");

    // 6) Payload parsen (jetzt dürfen wir JSON parsen)
    let payload = null;
    try {
      payload = JSON.parse(rawBodyString);
    } catch (e) {
      console.error("Failed to parse JSON payload:", e.message);
      // Payload ist optional – HMAC war ja schon ok.
    }

    // 7) (Optional) hier kannst du später nach Base44 weiterleiten
    // if (process.env.BASE44_WEBHOOK_URL) {
    //   await fetch(process.env.BASE44_WEBHOOK_URL, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       // optional: "x-api-key": process.env.BASE44_API_KEY || "",
    //     },
    //     body: rawBodyString,
    //   });
    // }

    return res.status(200).json({
      ok: true,
      message: "Webhook received and HMAC verified",
      // debug-info:
      // payload,
    });
  } catch (err) {
    console.error("Fatal error in webhook handler:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
