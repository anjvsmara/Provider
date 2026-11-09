# Kuronime TMDB metadata proxy

This Worker keeps the TMDB API key out of the public provider source.

## Deploy

1. In Cloudflare, open **Workers & Pages** and create a Worker named `kuronime-tmdb-proxy`.
2. Deploy the contents of `tmdb-proxy.js` as the Worker entry point.
3. Open the Worker settings and add a **Secret** named `TMDB_KEY`.
4. Set its value to a newly rotated TMDB API v3 key, then redeploy if Cloudflare prompts you.
5. Copy the Worker URL, for example `https://kuronime-tmdb-proxy.<your-subdomain>.workers.dev`.
6. Replace `https://YOUR-WORKER.workers.dev` in `providers/kuronime.js` with that URL.

Do not put the TMDB key in `providers/kuronime.js`, repository files, or chat messages.

## Routes

- `GET /find/{imdb_id}?external_source=imdb_id`
- `GET /tv/{tmdb_id}`
- `GET /movie/{tmdb_id}`

The Worker only forwards these fixed TMDB metadata routes. It is not a general-purpose proxy.
