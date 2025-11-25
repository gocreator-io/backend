// backend/api/shopify/auth/callback.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { shop, code, state } = req.query;

    if (!shop || !code) {
      return res.status(400).json({ error: "Missing shop or code" });
    }

    // 1) Access Token holen
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;

    const tokenResponse = await axios.post(tokenUrl, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = tokenResponse.data.access_token;
    const scope = tokenResponse.data.scope;

    console.log("Shopify OAuth success:", { shop, scope });

    if (!accessToken) {
      return res
        .status(400)
        .json({ error: "No access token received from Shopify" });
    }

    // 2) Shop in Base44 speichern
    const saveUrl = process.env.BASE44_SAVE_STORE_URL;
    const apiKey = process.env.BASE44_API_KEY; // denselben Key wie bei pingFromBackend

    if (!saveUrl || !apiKey) {
      console.error("Missing BASE44_SAVE_STORE_URL or BASE44_API_KEY");
    } else {
      try {
        // TODO: brand_id später dynamisch aus state/Token ableiten
        const brandId = "demo-brand"; // Platzhalter

        const saveResponse = await axios.post(
          saveUrl,
          {
            brand_id: brandId,
            shop_domain: shop,
            access_token: accessToken,
            scope,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
          }
        );

        console.log("Base44 saveShopifyStore response:", saveResponse.data);
      } catch (err) {
        console.error(
          "Error calling saveShopifyStore:",
          err.response?.data || err.message
        );
      }
    }

    // 3) (Optional) Webhooks registrieren
    try {
      const topics = [
        "orders/create",
        "app/uninstalled",
        // später: weitere Topics wie price rules etc.
      ];

      for (const topic of topics) {
        const webhookRes = await axios.post(
          `https://${shop}/admin/api/2024-01/webhooks.json`,
          {
            webhook: {
              topic,
              address: `${process.env.BACKEND_URL}/api/shopify/webhooks`, // Ziel-Route in deinem Backend
              format: "json",
            },
          },
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(
          `Registered webhook ${topic}:`,
          webhookRes.data.webhook?.id || "no id"
        );
      }
    } catch (err) {
      console.error(
        "Error registering webhooks:",
        err.response?.data || err.message
      );
    }

    // 4) Antwort an den Browser (oder redirect ins Frontend)
    return res.status(200).json({
      ok: true,
      message: "Shopify shop connected successfully",
      shop,
      scope,
    });
  } catch (err) {
    console.error("Shopify OAuth callback error:", err.response?.data || err);
    return res.status(500).json({
      error: "OAuth callback failed",
      details: err.response?.data || err.message,
    });
  }
}
