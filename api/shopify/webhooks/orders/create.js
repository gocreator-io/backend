// api/shopify/webhooks/orders/create.js
import crypto from 'crypto';
import getRawBody from 'raw-body';

export const config = {
  api: {
    // Wir brauchen den ungeparsten Body für die HMAC-Berechnung
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Shopify schickt Webhooks als POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error('Missing SHOPIFY_API_SECRET env variable');
    return res
      .status(500)
      .json({ ok: false, error: 'Missing SHOPIFY_API_SECRET' });
  }

  // 1) Roh-Body einlesen
  let rawBody;
  try {
    rawBody = (await getRawBody(req)).toString('utf8');
  } catch (err) {
    console.error('Error reading raw body:', err);
    return res.status(400).json({ ok: false, error: 'Cannot read body' });
  }

  // 2) HMAC aus Header holen
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  // 3) Unser eigenes HMAC berechnen
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  if (digest !== hmacHeader) {
    console.error('Invalid HMAC', { digest, hmacHeader });
    return res.status(401).json({ ok: false, error: 'Invalid HMAC' });
  }

  // 4) Body NACH erfolgreicher HMAC-Prüfung parsen
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('JSON parse error after valid HMAC:', err);
    return res
      .status(400)
      .json({ ok: false, error: 'Invalid JSON payload' });
  }

  console.log('✅ Valid Shopify order webhook received:', {
    id: payload.id,
    name: payload.name,
    total_price: payload.total_price,
  });

  // Shopify will nur ein 200 OK sehen
  return res.status(200).json({ ok: true });
}
