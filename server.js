import express from "express";
import crypto from "crypto";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// Root endpoint
app.get("/", (req, res) => {
  res.send("GoCreator Shopify/Instagram Backend is running.");
});

/**
 * STEP 1: Shopify OAuth Redirect
 */
app.get("/shopify/auth/start", (req, res) => {
  const shop = req.query.shop;
  const redirectUri = process.env.BACKEND_URL + "/shopify/auth/callback";

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

/**
 * STEP 2: Shopify OAuth Callback
 */
app.get("/shopify/auth/callback", async (req, res) => {
  const { shop, code } = req.query;

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;

  const tokenResponse = await axios.post(tokenUrl, {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code
  });

  const accessToken = tokenResponse.data.access_token;

  // TODO: Save accessToken + shop to Base44 DB using Service Role
  res.send("Shopify connected successfully!");
});

/**
 * STEP 3: Shopify Webhooks (example)
 */
app.post("/webhooks/orders/create", (req, res) => {
  const hmac = req.get("X-Shopify-Hmac-Sha256");

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(JSON.stringify(req.body), "utf8")
    .digest("base64");

  if (digest !== hmac) return res.status(401).send("Invalid HMAC");

  console.log("New order webhook:", req.body);

  res.sendStatus(200);
});

// Start server
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
