const ALLOWED_REDIRECT_HOSTS = [
    'fleet-api.prd.eu.vn.cloud.tesla.com',
    'fleet-api.prd.na.vn.cloud.tesla.com',
    'powergate.prd.sn.tesla.services',
    'ownership.tesla.com',
    'auth.tesla.com',
];

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
        let url = `${base}${path}`;
        let response;
        let redirects = 0;

        while (redirects < 5) {
            response = await fetch(url, {
                headers: { Authorization: auth },
                redirect: 'manual',
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;
                const redirectHost = new URL(location).hostname;
                if (!ALLOWED_REDIRECT_HOSTS.includes(redirectHost)) {
                    return res.status(502).json({ error: 'Redirect to disallowed host: ' + redirectHost });
                }
                url = location;
                redirects++;
            } else {
                break;
            }
        }

        const body = await response.json();
        return res.status(response.status).json(body);
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error', detail: err.message });
    }
};
