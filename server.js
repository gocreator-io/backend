import express from "express";
import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// -------------------- ROOT --------------------
app.get("/", (req, res) => {
  res.send("GoCreator Shopify/Instagram Backend is running.");
});

// -------------------- STEP 1: OAuth Redirect --------------------
app.get("/shopify/auth/start", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const redirectUri = process.env.BACKEND_URL + "/shopify/auth/callback";

  const installUrl =
    `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${process.env.SCOPES}` +
    `&redirect_uri=${redirectUri}`;

  return res.redirect(installUrl);
});

// -------------------- STEP 2: OAuth Callback --------------------
app.get("/shopify/auth/callback", async (req, res) => {
  try {
    const { shop, code } = req.query;
    if (!shop || !code) return res.status(400).send("Invalid callback");

    const tokenUrl = `https://${shop}/admin/oauth/access_token`;

    const tokenResponse = await axios.post(tokenUrl, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code
    });

    const accessToken = tokenResponse.data.access_token;

    // (Later you store this to Base44 via your backend → Base44 API)
    console.log("Shop connected:", shop);
    console.log("Access Token:", accessToken);

    res.send("Shopify connected successfully!");
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err);
    res.status(500).send("OAuth failed");
  }
});

// -------------------- STEP 3: Shopify Webhook Example --------------------
app.post("/webhooks/orders/create", (req, res) => {
  try {
    const hmac = req.get("X-Shopify-Hmac-Sha256");

    const digest = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(JSON.stringify(req.body), "utf8")
      .digest("base64");

    if (digest !== hmac) {
      return res.status(401).send("Invalid HMAC");
    }

    console.log("🟢 New order webhook:", req.body);

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook failed");
  }
});

/* -------------------------------------------------------
    CALL BASE44 PING FUNCTION FROM BACKEND
--------------------------------------------------------*/
app.get("/ping-base44", async (req, res) => {
  try {
    const url = process.env.BASE44_PING_URL; // Your Base44 function endpoint
    const apiKey = process.env.BASE44_API_KEY; // The key you added in Base44 env

    const response = await axios.post(
      url,
      {},
      { headers: { "x-api-key": apiKey } }
    );

    console.log("Base44 Ping Response:", response.data);

    res.json({ ok: true, base44: response.data });
  } catch (err) {
    console.error("Ping Base44 error:", err.response?.data || err);
    res.status(500).send("Ping Base44 failed");
  }
});

// -------------------- START SERVER --------------------
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
