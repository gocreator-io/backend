// api/shopify/webhooks/orders/create.js
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // wir brauchen den Roh-Body für HMAC
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // ---- Roh-Body einlesen ----
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'] || 'orders/create';
    const shop = req.headers['x-shopify-shop-domain'];

    if (!hmacHeader) {
      console.error('Missing HMAC header');
      return res.status(401).json({ ok: false, error: 'Missing HMAC header' });
    }

    // ---- HMAC prüfen ----
    const digest = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
      .update(rawBody)
      .digest('base64');

    if (digest !== hmacHeader) {
      console.error('Invalid HMAC', { digest, hmacHeader });
      return res.status(401).json({ ok: false, error: 'Invalid HMAC' });
    }

    // ---- Payload parsen ----
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
      console.error('Failed to parse JSON payload', err);
      return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
    }

    console.log('Shopify orders/create webhook verified', {
      shop,
      topic,
      order_id: payload.id,
    });

    // ---- an Base44 weiterleiten ----
    try {
      const base44Url = process.env.BASE44_ORDERS_WEBHOOK_URL;
      const apiKey = process.env.BASE44_API_KEY;

      if (!base44Url || !apiKey) {
        console.error('Missing BASE44_ORDERS_WEBHOOK_URL or BASE44_API_KEY env');
      } else {
        const forwardRes = await fetch(base44Url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            topic,
            shop,
            payload,
          }),
        });

        if (!forwardRes.ok) {
          const text = await forwardRes.text();
          console.error(
            'Base44 ordersFromBackend error',
            forwardRes.status,
            text,
          );
        } else {
          const json = await forwardRes.json().catch(() => null);
          console.log('Base44 ordersFromBackend response', json);
        }
      }
    } catch (err) {
      console.error('Error calling Base44 ordersFromBackend', err);
    }

    // Shopify muss schnell 200 bekommen, sonst retryt es
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Unexpected error in orders/create handler', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
