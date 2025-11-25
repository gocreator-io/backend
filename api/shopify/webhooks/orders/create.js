import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false, // notwendig für HMAC-Verifizierung
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const hmacHeader =
    req.headers["x-shopify-hmac-sha256"] ||
    req.headers["X-Shopify-Hmac-Sha256"];

  const rawBody = await getRawBody(req);

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest("base64");

  if (digest !== hmacHeader) {
    console.error("Invalid HMAC", { digest, hmacHeader });
    return res.status(401).json({ ok: false, error: "Invalid HMAC" });
  }

  // Shopify Payload parsen
  const payload = JSON.parse(rawBody.toString("utf8"));
  console.log("Valid orders/create webhook", {
    id: payload.id,
    name: payload.name,
  });

  return res.status(200).json({ ok: true });
}
