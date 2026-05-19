const ALLOWED_REDIRECT_HOSTS = [
    'fleet-api.prd.eu.vn.cloud.tesla.com',
    'fleet-api.prd.na.vn.cloud.tesla.com',
    'powergate.prd.sn.tesla.services',
    'ownership.tesla.com',
    'auth.tesla.com',
];

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

    // Read body for POST requests (Vercel parses JSON automatically)
    const reqBody = req.method === 'POST'
        ? JSON.stringify(req.body || {})
        : undefined;

    try {
        let url = `${base}${path}`;
        let method = req.method;
        let body = reqBody;
        let response;
        let redirects = 0;

        while (redirects < 5) {
            const fetchOpts = {
                method,
                headers: {
                    Authorization: auth,
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                },
                redirect: 'manual',
            };
            if (body) fetchOpts.body = body;

            response = await fetch(url, fetchOpts);

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;

                const redirectHost = new URL(location).hostname;
                if (!ALLOWED_REDIRECT_HOSTS.includes(redirectHost)) {
                    return res.status(502).json({ error: 'Redirect to disallowed host: ' + redirectHost });
                }

                url = location;
                // 307/308 preserve method; 301/302 also keep method here since
                // Tesla's internal powergate service requires POST
                redirects++;
            } else {
                break;
            }
        }

        const respBody = await response.json();
        return res.status(response.status).json(respBody);
    } catch (err) {
        return res.status(502).json({ error: 'Upstream error', detail: err.message });
    }
};
