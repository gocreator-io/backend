import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { shop, code, state } = req.query;

  if (!shop || !code) {
    return res.status(400).json({
      error: "Missing 'shop' or 'code' in callback query params",
    });
  }

  try {
    const clientId = process.env.SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: "SHOPIFY_API_KEY or SHOPIFY_API_SECRET missing in env vars",
      });
    }

    const tokenUrl = `https://${shop}/admin/oauth/access_token`;

    const tokenResponse = await axios.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    const accessToken = tokenResponse.data.access_token;
    const scope = tokenResponse.data.scope;

    if (!accessToken) {
      return res
        .status(400)
        .json({ error: "No access_token received from Shopify" });
    }

    console.log("Shopify OAuth success:", { shop, scope });

    // TODO: Hier später nach Base44 speichern (Shop + accessToken)
    // z.B. POST an einen Base44-Endpoint oder direkte Function

    return res.status(200).json({
      ok: true,
      message: "Shopify shop connected successfully",
      shop,
      scope,
    });
  } catch (err) {
    console.error("Shopify OAuth callback error:", err.response?.data || err);
    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message || "OAuth callback failed",
    });
  }
}
