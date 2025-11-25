// backend/api/shopify/auth/callback.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { shop, code, state } = req.query;

  if (!shop || !code || !state) {
    return res.status(400).json({
      error: "Missing 'shop', 'code' or 'state' in callback query",
    });
  }

  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET env vars",
    });
  }

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;

  try {
    // 1) OAuth-Code gegen Access-Token tauschen
    const tokenResponse = await axios.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    const accessToken = tokenResponse.data.access_token;
    const scope = tokenResponse.data.scope;

    if (!accessToken) {
      return res.status(400).json({
        error: "No access token returned from Shopify",
        raw: tokenResponse.data,
      });
    }

    console.log("Shopify OAuth success:", {
      shop,
      scope,
      state,
    });

    // 2) Verbindung in Base44 speichern
    const base44Url = process.env.BASE44_SAVE_SHOPIFY_URL;
    const apiKey = process.env.BASE44_API_KEY;

    let base44Result = null;

    if (!base44Url || !apiKey) {
      console.warn(
        "BASE44_SAVE_SHOPIFY_URL or BASE44_API_KEY not set – skipping save to Base44"
      );
    } else {
      try {
        const saveResponse = await axios.post(
          base44Url,
          {
            brandId: state, // state = brandId aus start.js
            shop,
            accessToken,
            scope,
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
          }
        );

        base44Result = saveResponse.data;
        console.log("Saved Shopify connection in Base44:", base44Result);
      } catch (err) {
        console.error(
          "Error saving Shopify connection in Base44:",
          err.response?.data || err.message
        );
      }
    }

    // 3) Antwort für dich / dein Frontend
    return res.status(200).json({
      ok: true,
      message: "Shopify shop connected successfully",
      shop,
      scope,
      base44: base44Result,
    });
  } catch (err) {
    console.error(
      "Shopify OAuth callback error:",
      err.response?.data || err.message
    );
    return res.status(500).json({
      ok: false,
      error: "OAuth callback failed",
      details: err.response?.data || err.message,
    });
  }
}
