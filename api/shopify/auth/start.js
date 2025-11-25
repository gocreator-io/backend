export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { shop } = req.query;

  if (!shop) {
    return res.status(400).json({
      error: "Missing 'shop' query parameter (e.g. ?shop=gocreator-dev.myshopify.com)",
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

  // Für jetzt ein simpler state – später können wir das pro User signieren
  const state = `gocreator-${Date.now()}`;

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(apiKey)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return res.redirect(installUrl);
}
