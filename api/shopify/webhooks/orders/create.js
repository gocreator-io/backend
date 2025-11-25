import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const secret = process.env.SHOPIFY_API_SECRET;

    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const rawBody = JSON.stringify(req.body);

    const digest = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("base64");

    if (digest !== hmacHeader) {
      console.error("Invalid HMAC", { digest, hmacHeader });
      return res.status(401).json({ ok: false, error: "Invalid HMAC" });
    }

    console.log("Webhook verified successfully!");
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
