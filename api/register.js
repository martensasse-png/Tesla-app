module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { client_id, client_secret, region } = req.body || {};
    if (!client_id || !client_secret) {
        return res.status(400).json({ error: 'client_id und client_secret erforderlich' });
    }

    const apiBase = region === 'eu'
        ? 'https://fleet-api.prd.eu.vn.cloud.tesla.com'
        : 'https://fleet-api.prd.na.vn.cloud.tesla.com';

    // Step 1: client_credentials token
    const tokenRes = await fetch('https://auth.tesla.com/oauth2/v3/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type:    'client_credentials',
            client_id,
            client_secret,
            scope:         'openid vehicle_device_data',
            audience:      apiBase,
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        return res.status(400).json({ error: 'Token-Fehler: ' + (err.error_description || tokenRes.status) });
    }

    const { access_token } = await tokenRes.json();

    // Step 2: register partner domain
    const domain = req.headers.host;
    const regRes = await fetch(`${apiBase}/api/1/partner_accounts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify({ domain }),
    });

    const body = await regRes.json().catch(() => ({}));
    return res.status(regRes.status).json(body);
};
