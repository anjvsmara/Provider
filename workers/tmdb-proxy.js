/**
 * Kuronime metadata proxy for Cloudflare Workers.
 *
 * Required Worker secret:
 *   TMDB_KEY = a newly rotated TMDB API key (v3)
 *
 * Routes used by providers/kuronime.js:
 *   GET /find/{imdb_id}?external_source=imdb_id
 *   GET /tv/{tmdb_id}
 *   GET /movie/{tmdb_id}
 *
 * This is a narrow metadata proxy, not a general-purpose URL proxy.
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Cache-Control": "public, max-age=300"
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json; charset=utf-8"
        }
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== "GET") {
            return jsonResponse({ error: "Method not allowed" }, 405);
        }

        if (!env.TMDB_KEY) {
            return jsonResponse({ error: "TMDB_KEY secret is not configured" }, 500);
        }

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length !== 2) {
            return jsonResponse({ error: "Not found" }, 404);
        }

        const [kind, identifier] = parts;
        let tmdbPath;

        if (kind === "find" && /^tt\\d+$/.test(identifier)) {
            tmdbPath = `/3/find/${encodeURIComponent(identifier)}`;
        } else if ((kind === "tv" || kind === "movie") && /^\\d+$/.test(identifier)) {
            tmdbPath = `/3/${kind}/${encodeURIComponent(identifier)}`;
        } else {
            return jsonResponse({ error: "Invalid metadata route" }, 400);
        }

        const upstream = new URL(`https://api.themoviedb.org${tmdbPath}`);
        upstream.searchParams.set("api_key", env.TMDB_KEY);

        if (kind === "find") {
            upstream.searchParams.set("external_source", "imdb_id");
        }

        try {
            const response = await fetch(upstream.toString(), {
                headers: { "Accept": "application/json" }
            });
            const body = await response.text();

            return new Response(body, {
                status: response.status,
                headers: {
                    ...CORS_HEADERS,
                    "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8"
                }
            });
        } catch (error) {
            return jsonResponse({ error: "TMDB request failed" }, 502);
        }
    }
};
