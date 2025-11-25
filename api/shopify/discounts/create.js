// api/shopify/discounts/create.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { brandId, code, percentage } = req.body || {};

    if (!brandId || !code || !percentage) {
      return res.status(400).json({
        ok: false,
        error: 'Missing brandId, code or percentage',
      });
    }

    // 1) ShopifyStore für die Brand aus Base44 holen
    const base44Response = await fetch(process.env.BASE44_GET_STORE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.BASE44_API_KEY,
      },
      body: JSON.stringify({ brandId }),
    });

    if (!base44Response.ok) {
      const text = await base44Response.text();
      console.error('Base44 store lookup failed:', text);
      return res.status(500).json({
        ok: false,
        error: 'Could not fetch store from Base44',
        details: text,
      });
    }

    const base44Data = await base44Response.json();
    if (!base44Data.ok || !base44Data.store) {
      return res.status(404).json({
        ok: false,
        error: 'Store not found in Base44',
        details: base44Data,
      });
    }

    const { shop_domain: shopDomain, access_token: accessToken } = base44Data.store;

    const apiVersion = '2024-01';
    const baseUrl = `https://${shopDomain}/admin/api/${apiVersion}`;

    // 2) Price Rule in Shopify erstellen
    const priceRuleBody = {
      price_rule: {
        title: `Affiliate ${code}`,
        target_type: 'line_item',
        target_selection: 'all',
        allocation_method: 'across',
        value_type: 'percentage',
        // Shopify erwartet negative Werte für Rabatte
        value: -Math.abs(percentage),
        customer_selection: 'all',
        once_per_customer: false,
        usage_limit: null,
        starts_at: new Date().toISOString(),
      },
    };

    const priceRuleResp = await fetch(`${baseUrl}/price_rules.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify(priceRuleBody),
    });

    if (!priceRuleResp.ok) {
      const text = await priceRuleResp.text();
      console.error('Create price_rule failed:', text);
      return res.status(400).json({
        ok: false,
        step: 'create_price_rule',
        error: text,
      });
    }

    const priceRuleData = await priceRuleResp.json();
    const priceRuleId = priceRuleData.price_rule.id;

    // 3) Discount Code für diese Price Rule erzeugen
    const discountBody = {
      discount_code: {
        code, // z.B. "CREATOR-ANNA-10"
      },
    };

    const discountResp = await fetch(
      `${baseUrl}/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(discountBody),
      }
    );

    if (!discountResp.ok) {
      const text = await discountResp.text();
      console.error('Create discount_code failed:', text);
      return res.status(400).json({
        ok: false,
        step: 'create_discount_code',
        error: text,
      });
    }

    const discountData = await discountResp.json();

    // TODO: Hier kannst du später auch in Base44 eine Entität "AffiliateCode" speichern

    return res.status(200).json({
      ok: true,
      message: 'Discount created successfully',
      brandId,
      shop: shopDomain,
      percentage,
      priceRule: priceRuleData.price_rule,
      discount: discountData.discount_code,
    });
  } catch (err) {
    console.error('discounts/create error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
