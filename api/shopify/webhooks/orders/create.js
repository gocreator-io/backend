// api/shopify/webhooks/orders/create.js
import crypto from "crypto";

/**
 * Hilfsfunktion: den rohen Request-Body einlesen (als String).
 * Vercel parsed hier NICHT automatisch, deswegen lesen wir selbst.
 */
async function getRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      resolve(body);
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

export default async function handler(req, res) {
  // 1) Nur POST erlauben
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: "Method not allowed" });
  }

  try {
    const secret = process.env.SHOPIFY_API_SECRET;

    if (!secret) {
      console.error(
        "SHOPIFY_API_SECRET ist nicht gesetzt – bitte in Vercel Env eintragen."
      );
      return res
        .status(500)
        .json({ ok: false, error: "Missing SHOPIFY_API_SECRET" });
    }

    // 2) rohen Body lesen
    const rawBody = await getRawBody(req);

    // 3) HMAC aus dem Header holen
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];

    if (!hmacHeader) {
      console.error("Kein x-shopify-hmac-sha256 Header vorhanden");
      return res
        .status(401)
        .json({ ok: false, error: "Missing HMAC header" });
    }

    // 4) eigene HMAC-Berechnung
    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    if (digest !== hmacHeader) {
      console.error("Invalid HMAC", { digest, hmacHeader });
      return res
        .status(401)
        .json({ ok: false, error: "Invalid HMAC" });
    }

    // 5) Ab hier ist der Webhook verifiziert → Payload parsen
    let payload = null;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error("Konnte Webhook-Body nicht parsen:", parseErr);
    }

    // Optional: ein paar Infos loggen
    if (payload) {
      console.log("✅ Verifizierter Shopify Order Webhook");
      console.log(
        "Shop:",
        req.headers["x-shopify-shop-domain"] || "unbekannt"
      );
      if (payload.id) {
        console.log("Order ID:", payload.id);
      }
    }

    // TODO: Hier kannst du später Base44 / deine App logik aufrufen
    // z.B. Umsätze tracken, Creator zuordnen usw.

    return res.status(200).json({
      ok: true,
      message: "Order webhook received and verified",
    });
  } catch (err) {
    console.error("Fehler im Order-Webhook-Handler:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message });
  }
}
