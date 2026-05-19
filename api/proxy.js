module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const { path, region } = req.query;
    if (!path) return res.status(400).json({ error: 'Missing path' });

    if (!path.startsWith('/api/1/')) {
        return res.status(403).json({ error: 'Forbidden path' });
    }

    const base = region === 'eu'
        ? 'https://fleet-api.prd.eu.vn.cloud.tesla.com'
        : 'https://fleet-api.prd.na.vn.cloud.tesla.com';

    try {
        const upstream = await fetch(`${base}${path}`, {
            headers: { Authorization: auth },
        });
        const body = await upstream.json();
        return res.status(upstream.status).json(body);
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error', detail: err.message });
    }
};
