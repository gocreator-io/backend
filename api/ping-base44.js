import axios from "axios";

export default async function handler(req, res) {
  // Wir erlauben GET & POST, damit der Test im Browser einfach ist
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = process.env.BASE44_PING_URL;
    const apiKey = process.env.BASE44_API_KEY;

    if (!url || !apiKey) {
      return res.status(500).json({
        ok: false,
        error: "BASE44_PING_URL oder BASE44_API_KEY fehlen in den Env Vars",
      });
    }

    console.log("Calling Base44 ping from serverless function:", {
      url,
      apiKeyPresent: !!apiKey,
      method: req.method,
    });

    const response = await axios.post(
      url,
      { from: "vercel-serverless" },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    console.log("Base44 Ping Response:", response.data);

    return res.status(200).json({
      ok: true,
      base44: response.data,
    });
  } catch (err) {
    console.error(
      "Ping Base44 error:",
      err.response?.data || err.message || err
    );
    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message || "Ping Base44 failed",
    });
  }
}
