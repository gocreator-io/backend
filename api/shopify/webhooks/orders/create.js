// api/shopify/webhooks/orders/create.js

import crypto from "crypto";
import getRawBody from "raw-body";

const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;

// Optional: Base44-Weiterleitung (nur verwenden, wenn du diese Variablen gesetzt hast)
const BASE44_WEBHOOK_URL = process.env.BASE44_WEBHOOK_URL; // z.B. https://influence-flow-...base44.app/functions/handleShopifyWebhook
const BASE44_API_KEY = process.env.BASE44_API_KEY;          // dein x-api-key für Base44

export default async function handler(req, res) {
  // 1) Nur POST erlauben
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 2) Header auslesen
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] || "";
    const topic = req.headers["x-shopify-topic"] || "";
    const shop = req.headers["x-shopify-shop-domain"] || "";

    // 3) Roh-Body als Buffer einlesen
    const rawBody = await getRawBody(req);
    console.log("Webhook received", {
      topic,
      shop,
      length: rawBody.length,
    });

    // 4) HMAC aus Raw-Body berechnen
    const digest = crypto
      .createHmac("sha256", SHOPIFY_SECRET)
      .update(rawBody)
      .digest("base64");

    console.log("Secret prefix:", SHOPIFY_SECRET?.slice(0, 6));
    console.log("Computed digest:", digest);
    console.log("Header HMAC:", hmacHeader);

    // 5) Timing-safe Vergleich
    const digestBuf = Buffer.from(digest, "utf8");
    const headerBuf = Buffer.from(hmacHeader, "utf8");

    if (
      digestBuf.length !== headerBuf.length ||
      !crypto.timingSafeEqual(digestBuf, headerBuf)
    ) {
      console.error("Invalid HMAC:", {
        digest,
        hmacHeader,
      });
      return res.status(401).json({
        ok: false,
        error: "Invalid HMAC",
      });
    }

    // 6) Body jetzt normal parsen
    const bodyJson = JSON.parse(rawBody.toString("utf8"));
    console.log("Webhook verified, order payload size:", rawBody.length);

    // 7) Optional: an Base44 weiterleiten
    if (BASE44_WEBHOOK_URL && BASE44_API_KEY) {
      try {
        const forwardResp = await fetch(BASE44_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": BASE44_API_KEY,
          },
          body: JSON.stringify({
            topic,
            shop,
            payload: bodyJson,
          }),
        });

        console.log(
          "Forwarded to Base44, status:",
          forwardResp.status
        );
      } catch (err) {
        console.error("Error forwarding to Base44:", err);
      }
    }

    // 8) Shopify erwartet 200, sonst wiederholt es den Webhook
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error in orders/create webhook:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
