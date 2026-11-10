const WORKER_URL = "https://kuroproxy.anjvsmara.workers.dev";

const BASE_URL = "https://kuronime.sbs";
const SOURCES_API = "https://animeku.org/api/v9/sources";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let lastEmbedHosts = [];

const SKIP_HOSTS = ['dsvplay.com', 'vidhidevip.com', 'callistanise.com', 'vidhidepro', 'vidhide', 'krakenfiles.com'];
const HOST_TIMEOUT_MS = 8000;

const ALLOWED_HOSTS = ['pixeldrain.com', 'mp4upload.com'];

function isAllowedHost(url) {
    const u = (url || '').toLowerCase();
    return ALLOWED_HOSTS.some(h => u.indexOf(h) >= 0) || isDirectMedia(url);
}

function isSkippedHost(url) {
    const u = (url || '').toLowerCase();
    return SKIP_HOSTS.some(h => u.indexOf(h) >= 0);
}

function withTimeout(promise, ms) {
    if (typeof setTimeout !== 'function') return promise;
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve([]), ms))
    ]);
}

const MEDIA_REGEX_SRC = "https?:\\/\\/[^\"'\\s<]+?(?:\\.m3u8|\\.mp4)(?!\\w)|https?:\\/\\/[^\"'\\s<]+?(?:googlevideo|blogger|blogspot|bloggerusercontent|pixeldrain)[^\"'\\s<]*";

function flatten(arrays) {
    return arrays.reduce((acc, arr) => acc.concat(arr), []);
}

function decodeEntities(s) {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
    return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttr(tag, name) {
    const re = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
    const m = tag.match(re);
    return m ? decodeEntities(m[1]) : null;
}

function normalizeQuality(q) {
    const m = String(q || "").match(/(\d{3,4})\s*p/i);
    return m ? m[1] + "p" : "Auto";
}

function getQualityFromUrl(url) {
    const match = url.match(/\b(2160|1440|1080|720|480|360|240)\b/);
    return match ? match[1] + "p" : "Auto";
}

async function fetchText(url, options) {
    const opts = options || {};
    const res = await fetch(url, {
        ...opts,
        headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) }
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

async function tmdbGet(path) {
    const body = await fetchText(WORKER_URL + "/tmdb?path=" + encodeURIComponent(path));
    return JSON.parse(body);
}

async function decryptViaWorker(encoded) {
    const res = await fetch(WORKER_URL + "/decrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({ encoded: encoded })
    });
    if (res.status >= 400) return null;
    return JSON.parse(await res.text());
}

async function decodeMirrorPayload(encoded) {
    try {
        return await decryptViaWorker(encoded);
    } catch (e) {
        return null;
    }
}

function unescapeJs(s) {
    return s.replace(/\\(['"\\])/g, '$1');
}

function unpack(html) {
    const re = /\}\s*\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[^\\])*)\5\.split\('\|'\)/;
    const m = html.match(re);
    if (!m) return html;

    try {
        const payload = unescapeJs(m[2]);
        const radix = parseInt(m[3], 10);
        let count = parseInt(m[4], 10);
        const keywords = unescapeJs(m[6]).split('|');

        const encode = (c) =>
            (c < radix ? '' : encode(Math.floor(c / radix))) +
            ((c % radix) > 35 ? String.fromCharCode((c % radix) + 29) : (c % radix).toString(36));

        let out = payload;
        while (count--) {
            if (keywords[count]) {
                const token = encode(count);
                const word = keywords[count];
                out = out.replace(new RegExp('\\b' + token + '\\b', 'g'), () => word);
            }
        }
        return out;
    } catch (e) {
        return html;
    }
}

function isDirectMedia(url) {
    const cleanUrl = url.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith(".html") || cleanUrl.endsWith(".htm")) return false;

    const pathParts = cleanUrl.split('/');
    if (pathParts.length < 4 || pathParts[3] === "") return false;

    return cleanUrl.endsWith(".m3u8") ||
           cleanUrl.endsWith(".mp4") ||
           cleanUrl.indexOf("mime=video/mp4") >= 0 ||
           cleanUrl.indexOf("mime=video%2fmp4") >= 0 ||
           cleanUrl.indexOf("googlevideo") >= 0 ||
           cleanUrl.indexOf("bloggerusercontent") >= 0 ||
           cleanUrl.indexOf("pixeldrain.com/api/file/") >= 0;
}

function hostLabel(url) {
    const u = (url || '').toLowerCase();
    if (u.indexOf('pixeldrain.com') >= 0) return "Pixeldrain";
    if (u.indexOf('mp4upload.com') >= 0) return "Mp4Upload";
    if (u.indexOf('googlevideo') >= 0) return "Google";
    if (u.indexOf('blogger') >= 0 || u.indexOf('blogspot') >= 0) return "Blogger";
    return "Kuronime";
}

function pixeldrainStream(url, quality) {
    const m = url.match(/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/);
    if (!m) return null;
    return {
        name: "Pixeldrain",
        title: `Kuronime - Pixeldrain (${quality})`,
        url: `https://pixeldrain.com/api/file/${m[1]}`,
        quality: quality,
        headers: { "User-Agent": USER_AGENT }
    };
}

function streamFromUrl(url, referer, quality) {
    const q = normalizeQuality(quality || getQualityFromUrl(url));
    if (url.indexOf('pixeldrain.com') >= 0) return pixeldrainStream(url, q);
    if (isDirectMedia(url)) {
        const label = hostLabel(url);
        return {
            name: label,
            title: `Kuronime - ${label} (${q})`,
            url: url,
            quality: q,
            headers: { "Referer": referer, "User-Agent": USER_AGENT }
        };
    }
    return null;
}

function debugStream(msg) {
    return {
        name: msg.slice(0, 180),
        title: "DEBUG",
        url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
        quality: "360p"
    };
}

const LOW_QUALITIES = ['240p', '360p', '480p'];
const PREFERRED_QUALITIES = ['720p', '1080p'];

function dedupeStreams(streams) {
    const seen = new Set();
    const unique = streams.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
    const hasPreferred = unique.some(s => PREFERRED_QUALITIES.indexOf(s.quality) >= 0);
    if (!hasPreferred) return unique;
    return unique.filter(s => LOW_QUALITIES.indexOf(s.quality) < 0);
}

function collectUrlsFromHtml(html) {
    const found = [];
    const tagRe = /<(iframe|video|source)\b[^>]*>/gi;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
        const src = getAttr(m[0], 'src') || getAttr(m[0], 'data-src');
        if (src && src.indexOf('http') === 0) found.push(src.trim());
    }
    const mediaRe = new RegExp(MEDIA_REGEX_SRC, 'gi');
    while ((m = mediaRe.exec(html)) !== null) found.push(m[0]);
    return found;
}

async function resolveMp4Upload(playerUrl, referer, quality) {
    try {
        const html = await fetchText(playerUrl, { headers: { "Referer": referer } });
        const unpacked = unpack(html);
        const m = unpacked.match(/player\.src\(\s*["']([^"']+)["']/) ||
                  unpacked.match(/src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/) ||
                  html.match(/player\.src\(\s*["']([^"']+)["']/);
        if (!m) return null;
        const videoUrl = m[1];
        if (videoUrl.indexOf('http') !== 0) return null;
        const q = normalizeQuality(quality || getQualityFromUrl(videoUrl));
        return {
            name: "Mp4Upload",
            title: "Kuronime - Mp4Upload (" + q + ")",
            url: videoUrl,
            quality: q,
            headers: { "Referer": "https://www.mp4upload.com/", "User-Agent": USER_AGENT }
        };
    } catch (err) {
        return null;
    }
}

async function inspectPlayerPage(playerUrl, referer, quality) {
    const direct = streamFromUrl(playerUrl, referer, quality);
    if (direct) return [direct];

    if (playerUrl.indexOf('mp4upload.com') >= 0) {
        const mp4 = await resolveMp4Upload(playerUrl, referer, quality);
        if (mp4) return [mp4];
    }

    try {
        const html = await fetchText(playerUrl, { headers: { "Referer": referer } });
        const clean = unpack(html).replace(/\\\//g, '/');
        const streams = [];
        for (const url of collectUrlsFromHtml(clean)) {
            const s = streamFromUrl(url, playerUrl, quality);
            if (s) streams.push(s);
        }
        return streams;
    } catch (err) {
        return [];
    }
}

async function resolveTmdb(id, mediaType) {
    const s = String(id).trim();
    if (!/^tt\d+$/.test(s)) return { id: s, type: mediaType };

    const data = await tmdbGet(`/3/find/${s}?external_source=imdb_id`);
    const movies = data.movie_results || [];
    const shows = data.tv_results || [];

    if (mediaType === 'movie' && movies.length) return { id: movies[0].id, type: 'movie' };
    if (shows.length) return { id: shows[0].id, type: 'tv' };
    if (movies.length) return { id: movies[0].id, type: 'movie' };
    throw new Error('IMDb ID tidak ditemukan di TMDB: ' + s);
}

async function getAnimeTitle(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const data = await tmdbGet(`/3/${endpoint}/${tmdbId}`);
    const title = mediaType === 'tv' ? data.name : data.title;
    if (!title) throw new Error('TMDB response tidak punya judul');
    return {
        title: title,
        originalTitle: data.original_name || data.original_title || "",
        seasons: (data.seasons || []).reduce((acc, se) => { acc[se.season_number] = se.episode_count; return acc; }, {})
    };
}

function anchorsIn(html) {
    const out = [];
    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        out.push({ tag: '<a' + m[1] + '>', inner: m[2] });
    }
    return out;
}

function pickAnime(block) {
    for (const a of anchorsIn(block)) {
        const href = getAttr(a.tag, 'href');
        if (!href || href.indexOf('/anime/') < 0) continue;

        const imgTag = (a.inner.match(/<img\b[^>]*>/i) || [''])[0];
        const h2 = (a.inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || ['', ''])[1];
        const title = getAttr(a.tag, 'title') ||
                      stripTags(h2) ||
                      getAttr(imgTag, 'alt') ||
                      stripTags(a.inner);
        if (title) return { title: title.trim(), url: href.trim() };
    }
    return null;
}

function cleanQuery(q) {
    return String(q || '').replace(/[:.~!?'"’‘“”`]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchWithFallback(q) {
    const cleaned = cleanQuery(q);
    if (!cleaned) return [];
    let results = await searchKuronime(cleaned);
    if (results.length === 0) {
        const words = cleaned.split(' ').filter(w => w.length > 0);
        if (words.length > 3) {
            results = await searchKuronime(words.slice(0, 3).join(' '));
        }
    }
    return results;
}

async function searchKuronime(query) {
    const html = await fetchText(`${BASE_URL}/?s=${encodeURIComponent(query)}`, {
        headers: { "Referer": BASE_URL }
    });

    const results = [];

    const articleRe = /<article\b[^>]*class="[^"]*\bbs\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let m;
    while ((m = articleRe.exec(html)) !== null) {
        const item = pickAnime(m[1]);
        if (item) results.push(item);
    }

    for (const a of anchorsIn(html)) {
        if (!/\bseries\b/.test(getAttr(a.tag, 'class') || '')) continue;
        const href = getAttr(a.tag, 'href');
        if (!href || href.indexOf('/anime/') < 0) continue;
        const title = getAttr(a.tag, 'title') || stripTags(a.inner);
        if (title) results.push({ title: title.trim(), url: href.trim() });
    }

    const seen = new Set();
    return results.filter(item => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
    });
}

const normalizeTitle = (s) =>
    (s || '').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff01-\uff0f]+/g, '');

function latinTokens(s) {
    return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 0);
}

function seasonOf(title) {
    const t = (title || '').toLowerCase();
    let m = t.match(/season\s*(\d+)/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/);
    if (m) return parseInt(m[1], 10);
    return null;
}

function findBestMatch(results, titles, season, mediaType) {
    const anySeason = season === 'any';
    const want = anySeason ? null : (Number(season) > 1 ? Number(season) : 1);

    const all = results
        .map(r => ({
            title: r.title,
            url: r.url,
            key: normalizeTitle(r.title),
            tok: latinTokens(r.title),
            rawSeason: seasonOf(r.title),
            season: seasonOf(r.title) || 1
        }))
        .filter(i => i.key)

        .filter(i => !(mediaType === 'tv' && /\bmovie\b/i.test(i.title)));

    let items = anySeason ? all : all.filter(i => i.season === want);
    if (!anySeason && items.length === 0 && want > 1) {
        items = all.filter(i => i.rawSeason === null);
    }

    const targets = titles.map(normalizeTitle).filter(Boolean);
    if (items.length === 0 || targets.length === 0) return null;

    for (const t of targets) {
        const hit = items.find(i => i.key === t);
        if (hit) return hit;
    }

    for (const t of targets) {
        if (t.length < 4) continue;
        const hits = items.filter(i => i.key.length >= 4 && (i.key.indexOf(t) >= 0 || t.indexOf(i.key) >= 0));
        if (hits.length) {
            return hits.reduce((a, b) => (b.key.length < a.key.length ? b : a));
        }
    }

    let best = null;
    for (const title of titles) {
        const tTok = [...new Set(latinTokens(title))];
        if (tTok.length < 2) continue;
        for (const item of items) {
            const itemSet = new Set(item.tok);
            const shared = tTok.filter(w => itemSet.has(w)).length;
            const ratio = shared / tTok.length;
            if (shared < 2 || ratio < 0.6) continue;

            if (!best || ratio > best.ratio || (ratio === best.ratio && item.tok.length < best.item.tok.length)) {
                best = { item, ratio };
            }
        }
    }
    return best ? best.item : null;
}

async function getEpisodes(animeUrl) {
    const html = await fetchText(animeUrl, { headers: { "Referer": BASE_URL } });

    const start = html.search(/class="[^"]*bixbox[^"]*bxcl/);
    const scope = start >= 0 ? html.slice(start) : html;

    const episodes = [];
    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(scope)) !== null) {
        const anchor = anchorsIn(m[1]).find(a => (getAttr(a.tag, 'href') || '').indexOf('/nonton-') >= 0);
        if (!anchor) continue;

        const href = getAttr(anchor.tag, 'href');
        const rawTitle = stripTags(anchor.inner);
        const epMatch = rawTitle.match(/Episode\s+(\d+(?:\.\d+)?)/i);

        episodes.push({
            title: rawTitle,
            episodeNum: epMatch ? parseFloat(epMatch[1]) : null,
            url: href.trim()
        });
    }
    return episodes;
}

function collectEmbedUrls(mirror) {
    const items = [];
    if (!mirror) return items;

    if (mirror.embed) {
        for (const quality in mirror.embed) {
            const hosts = mirror.embed[quality];
            for (const hostName in hosts) {
                const url = hosts[hostName];
                if (url && url.indexOf('http') === 0) items.push({ url: url, quality: quality });
            }
        }
    }
    for (const key of ['filelions', 'blog', 'raw']) {
        const url = mirror[key];
        if (url && url.indexOf('http') === 0) items.push({ url: url, quality: 'Auto' });
    }
    return items;
}

async function inspectPageFallback(html, episodeUrl, visited) {
    const candidates = [];
    const iframeRe = /<iframe\b[^>]*>/gi;
    let m;
    while ((m = iframeRe.exec(html)) !== null) {
        const src = (getAttr(m[0], 'src') || getAttr(m[0], 'data-src') || '').trim();
        if (src.indexOf('http') === 0 && !visited.has(src) && !isSkippedHost(src)) candidates.push(src);
    }
    const results = await Promise.all(candidates.map(u => inspectPlayerPage(u, episodeUrl)));
    return flatten(results);
}

async function extractStreamsFromEpisode(episodeUrl) {
    const html = await fetchText(episodeUrl, { headers: { "Referer": BASE_URL } });

    const idMatch = html.match(/var\s+_0xa100d42aa\s*=\s*["']([^"']+)["']/);
    if (!idMatch) {
        return dedupeStreams(await inspectPageFallback(html, episodeUrl, new Set()));
    }

    let sources;
    try {
        const body = await fetchText(SOURCES_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": BASE_URL,
                "Referer": episodeUrl,
                "Accept": "application/json, text/plain, */*"
            },
            body: JSON.stringify({ id: idMatch[1] })
        });
        sources = JSON.parse(body);
    } catch (err) {
        return dedupeStreams(await inspectPageFallback(html, episodeUrl, new Set()));
    }

    const mirror = sources.mirror ? await decodeMirrorPayload(sources.mirror) : null;
    const embedItems = collectEmbedUrls(mirror);
    lastEmbedHosts = embedItems.map(i => ((i.url.match(/^https?:\/\/([^\/]+)/) || [])[1] || "?"));
    const usableItems = embedItems.filter(i => !isSkippedHost(i.url) && isAllowedHost(i.url));

    if (usableItems.length === 0) {
        return dedupeStreams(await inspectPageFallback(html, episodeUrl, new Set()));
    }

    const results = await Promise.all(usableItems.map(item => {
        const direct = streamFromUrl(item.url, episodeUrl, item.quality);
        return direct
            ? Promise.resolve([direct])
            : withTimeout(inspectPlayerPage(item.url, episodeUrl, item.quality), HOST_TIMEOUT_MS);
    }));
    let streams = flatten(results);

    if (streams.length === 0) {
        const visited = new Set(usableItems.map(i => i.url));
        streams = await inspectPageFallback(html, episodeUrl, visited);
    }

    return dedupeStreams(streams);
}

const ANILIST_QUERY = "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } synonyms } }";

async function getAniListTitles(title) {
    try {
        const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": USER_AGENT
            },
            body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: title } })
        });
        if (res.status >= 400) return [];
        const data = JSON.parse(await res.text());
        const media = data && data.data && data.data.Media;
        if (!media) return [];

        const t = media.title || {};
        const candidates = [t.romaji, t.english].concat(media.synonyms || []);
        const out = [];
        for (const v of candidates) {
            if (!v || out.indexOf(v) >= 0) continue;
            if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(v)) continue;
            out.push(v);
        }
        return out;
    } catch (err) {
        return [];
    }
}

async function getStreams(tmdbId, mediaType, season, episode) {
    mediaType = (mediaType === 'series' || mediaType === 'tv') ? 'tv' : 'movie';
    if (season === -1) season = null;
    if (episode === -1) episode = null;

    if (!WORKER_URL || WORKER_URL.indexOf("ISI-") >= 0) {
        return [debugStream("CONFIG: WORKER_URL belum diisi")];
    }

    try {
        const resolved = await resolveTmdb(tmdbId, mediaType);
        mediaType = resolved.type;

        const info = await getAnimeTitle(resolved.id, mediaType);

        const seasonNum = Number(season) || 1;

        let results = await searchWithFallback(info.title);
        if (results.length === 0 && info.originalTitle) {
            results = await searchWithFallback(info.originalTitle);
        }
        let match = findBestMatch(results, [info.title, info.originalTitle], seasonNum, mediaType);

        let aliases = [];
        if (!match) {
            aliases = await getAniListTitles(info.title);

            match = findBestMatch(results, aliases, seasonNum, mediaType);

            for (const alias of aliases) {
                if (match) break;
                const aliasResults = await searchWithFallback(alias);
                const aliasMatch = findBestMatch(aliasResults, [alias], seasonNum, mediaType);
                if (aliasMatch) {
                    match = aliasMatch;
                    break;
                }
            }
        }

        if (!match) {
            const first = results.length ? results[0].title : "-";
            return [debugStream("NOMATCH search=" + results.length + " first=" + first + " al=" + aliases.join(" | ") + " tmdb=" + info.title + " orig=" + info.originalTitle)];
        }

        const episodes = await getEpisodes(match.url);

        const seasonEps = info.seasons ? info.seasons[seasonNum] : null;
        if (mediaType === 'tv' && seasonNum > 1 && seasonEps && episodes.length > seasonEps * 1.5 + 2) {

            const prevSum = Object.keys(info.seasons)
                .filter(k => Number(k) > 0 && Number(k) < seasonNum)
                .reduce((a, k) => a + info.seasons[k], 0);
            if (prevSum > 0 && episodes.length >= prevSum + seasonEps) {
                const absEp = prevSum + Number(episode);
                const absTarget = episodes.find(e => e.episodeNum === absEp);
                if (!absTarget) {
                    return [debugStream("NOEP absolute ep=" + absEp + " eps=" + episodes.length)];
                }
                const absStreams = await extractStreamsFromEpisode(absTarget.url);
                return absStreams.length
                    ? absStreams
                    : [debugStream("NOSTREAM hosts=" + lastEmbedHosts.join(",") + " ep=" + absTarget.url)];
            }
            return [debugStream("NOMATCH wrong page eps=" + episodes.length + " tmdb_season_eps=" + seasonEps + " url=" + match.url)];
        }

        if (mediaType === 'movie') {
            const episodeUrl = episodes.length > 0 ? episodes[0].url : match.url;
            const movieStreams = await extractStreamsFromEpisode(episodeUrl);
            return movieStreams.length ? movieStreams : [debugStream("NOSTREAM hosts=" + lastEmbedHosts.join(",") + " url=" + episodeUrl)];
        }

        const numbered = episodes.filter(e => e.episodeNum !== null);
        let target = numbered.find(e => e.episodeNum === episode);

        if (!target && numbered.length === 0 && episode && episodes.length >= episode) {
            target = episodes[episode - 1];
        }

        if (!target) {
            return [debugStream("NOEP episodes=" + episodes.length + " numbered=" + numbered.length + " ep=" + episode)];
        }
        const seriesStreams = await extractStreamsFromEpisode(target.url);
        return seriesStreams.length ? seriesStreams : [debugStream("NOSTREAM hosts=" + lastEmbedHosts.join(",") + " ep=" + target.url)];
    } catch (err) {
        return [debugStream("ERROR: " + err.message)];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
