// backend/api/shopify/auth/start.js
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { shop, brandId } = req.query;

  if (!shop || !brandId) {
    return res.status(400).json({
      error: "Missing 'shop' or 'brandId' query parameter (e.g. ?shop=myshop.myshopify.com&brandId=123)",
    });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES;
  const backendUrl = process.env.BACKEND_URL;

  if (!apiKey || !scopes || !backendUrl) {
    return res.status(500).json({
      error: "Missing SHOPIFY_API_KEY, SHOPIFY_SCOPES or BACKEND_URL env vars",
    });
  }

  const redirectUri = `${backendUrl}/api/shopify/auth/callback`;

  // Einfacher State: = brandId (später kannst du hier noch ein CSRF-Token einbauen)
  const state = brandId;

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  const installUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;

  return res.redirect(installUrl);
}
