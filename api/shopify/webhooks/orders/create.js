// api/shopify/webhooks/orders/create.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // --- 1) Roh-Body einsammeln ---
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBodyBuffer = Buffer.concat(chunks);
    const rawBodyString = rawBodyBuffer.toString("utf8");

    // --- 2) Secret & Header holen ---
    const rawSecret = process.env.SHOPIFY_API_SECRET || "";
    const secretTrimmed = rawSecret.trim();

    const hmacHeader =
      req.headers["x-shopify-hmac-sha256"] ||
      req.headers["X-Shopify-Hmac-SHA256".toLowerCase()];

    if (!hmacHeader) {
      console.error("Missing X-Shopify-Hmac-SHA256 header");
      return res.status(401).json({ ok: false, error: "Missing HMAC header" });
    }

    console.log("Webhook received {");
    console.log("  topic: 'orders/create',");
    console.log("  shop:", req.headers["x-shopify-shop-domain"] || "?", ",");
    console.log("  length:", rawBodyBuffer.length, ",");
    console.log("}");
    console.log("Secret prefix (raw):", rawSecret.slice(0, 6), "len:", rawSecret.length);
    console.log("Secret prefix (trim):", secretTrimmed.slice(0, 6), "len:", secretTrimmed.length);
    console.log("Header HMAC:", hmacHeader);

    // --- 3) Helfer zum HMAC-Berechnen ---
    const computeDigest = (secret, data, label) => {
      const d = crypto.createHmac("sha256", secret).update(data).digest("base64");
      console.log(`Digest [${label}]:`, d);
      return d;
    };

    // Wir probieren ein paar realistische Varianten:
    const candidates = [
      {
        label: "buffer + rawSecret",
        digest: computeDigest(rawSecret, rawBodyBuffer, "buffer + rawSecret"),
      },
      {
        label: "string + rawSecret",
        digest: computeDigest(rawSecret, rawBodyString, "string + rawSecret"),
      },
    ];

    if (secretTrimmed !== rawSecret) {
      candidates.push(
        {
          label: "buffer + trimmedSecret",
          digest: computeDigest(secretTrimmed, rawBodyBuffer, "buffer + trimmedSecret"),
        },
        {
          label: "string + trimmedSecret",
          digest: computeDigest(secretTrimmed, rawBodyString, "string + trimmedSecret"),
        }
      );
    }

    // --- 4) Timing-sicher prüfen, ob eine Variante passt ---
    const headerBuffer = Buffer.from(hmacHeader, "utf8");
    let matchedLabel = null;

    for (const cand of candidates) {
      const candBuf = Buffer.from(cand.digest, "utf8");
      if (candBuf.length !== headerBuffer.length) {
        continue;
      }
      if (crypto.timingSafeEqual(candBuf, headerBuffer)) {
        matchedLabel = cand.label;
        break;
      }
    }

    if (!matchedLabel) {
      console.error("❌ Invalid HMAC – none of the variants matched");
      return res.status(401).json({
        ok: false,
        error: "Invalid HMAC",
      });
    }

    console.log("✅ HMAC valid, matched variant:", matchedLabel);

    // --- 5) Payload parsen (optional) ---
    let payload = null;
    try {
      payload = JSON.parse(rawBodyString);
    } catch (e) {
      console.warn("Failed to parse JSON payload (non-fatal):", e.message);
    }

    // --- 6) (Optional) nach Base44 weiterleiten – später aktivieren ---
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
      matchedVariant: matchedLabel,
    });
  } catch (err) {
    console.error("Fatal error in webhook handler:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
