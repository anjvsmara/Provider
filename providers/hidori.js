const BASE_URL = "https://v8.hidoristream.online";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const SOURCE_DOMAINS = [
    "https://v8.hidoristream.online",
    "https://hidoristream.com",
    "https://hidoristream.my.id",
    "https://v4.hidoristream.online",
    "https://v3.hidoristream.online",
    "https://v2.hidoristream.online",
    "https://v1.hidoristream.online"
];

const SKIP_HOSTS = ['mirrored.to', 'dsvplay.com', 'vidhidevip.com', 'callistanise.com', 'vidhidepro', 'vidhide', 'krakenfiles.com'];

function isSkippedHost(url) {
    const u = (url || '').toLowerCase();
    return SKIP_HOSTS.some(h => u.indexOf(h) >= 0);
}

function hostLabel(url) {
    const u = (url || '').toLowerCase();
    if (u.includes('ayokunjungi')) return "Hidori (Server 1)";
    if (u.includes('storeghido') || u.includes('stotagehidori') || u.includes('storagehidori')) return "Hidori (Server 2)";
    return "Hidori Direct";
}

function debugStream(msg) {
    return {
        name: msg.slice(0, 180),
        title: "DEBUG",
        url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
        quality: "360p"
    };
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

function decodeEntities(s) {
    return (s || '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
    return decodeEntities((s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttr(tag, name) {
    const re = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
    const m = (tag || '').match(re);
    return m ? decodeEntities(m[1]) : null;
}

function parseQualityText(text) {
    if (!text) return null;
    const m = String(text).match(/\b(2160|1440|1080|720|480|360|240)\s*p?\b/i);
    return m ? m[1] + "p" : null;
}

function getQualityFromUrl(url) {
    const u = url || "";
    const match = u.match(/(?:_|\/|\.|\b)(2160|1440|1080|720|480|360|240)(?:p|_|\/|\.|\b)/i);
    if (match) return match[1] + "p";
    return "Auto";
}

function cleanTitle(s) {
    return (s || '')
        .replace(/\b(Sub(\s*)?(title)?\s*Indonesia|Subtitle\s*Indonesia|Sub\s*Indo)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeTitle(s) {
    return (s || '').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff01-\uff0f]+/g, '');
}

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

function anchorsIn(html) {
    const out = [];
    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        out.push({ tag: '<a' + m[1] + '>', inner: m[2] });
    }
    return out;
}

function cleanQuery(q) {
    return String(q || '').replace(/[:.~!?'"’‘“”`\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWorkingDocument(pathOrUrl) {
    const paths = pathOrUrl.startsWith("http") ? [pathOrUrl] : SOURCE_DOMAINS.map(d => d.replace(/\/$/, '') + '/' + pathOrUrl.replace(/^\//, ''));
    for (const p of paths) {
        try {
            const html = await fetchText(p, { headers: { "Referer": BASE_URL } });
            return { html, url: p };
        } catch (e) {}
    }
    throw new Error("Gagal mengambil halaman dari semua domain HidoriStream.");
}

async function searchHidoriStream(query) {
    const encoded = encodeURIComponent(query);
    const { html } = await fetchWorkingDocument(`/?s=${encoded}`);
    
    let scope = "";
    const mainStart = html.search(/class="[^"]*(?:listupd|postbody|result|main-content)[^"]*"/i);
    if (mainStart >= 0) {
        const sub = html.slice(mainStart);
        const sidebarStart = sub.search(/class="[^"]*(?:sidebar|widgets)[^"]*"/i);
        scope = sidebarStart > 0 ? sub.slice(0, sidebarStart) : sub.slice(0, 30000);
    } else {
        scope = html;
    }

    const results = [];
    const articleRe = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
    let m;
    while ((m = articleRe.exec(scope)) !== null) {
        const block = m[1];
        const a = anchorsIn(block).find(item => {
            const h = getAttr(item.tag, 'href') || '';
            return h.indexOf('/anime/') >= 0 || h.indexOf('/series/') >= 0;
        });
        if (!a) continue;
        const href = getAttr(a.tag, 'href');
        const titleTag = (block.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>|<div[^>]*class="[^"]*tt[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[0];
        const rawTitle = stripTags(titleTag) || getAttr(a.tag, 'title') || stripTags(a.inner);
        const title = cleanTitle(rawTitle);
        if (title && href) {
            results.push({ title, url: href });
        }
    }

    const seen = new Set();
    return results.filter(i => {
        if (seen.has(i.url)) return false;
        seen.add(i.url);
        return true;
    });
}

async function searchWithFallback(q) {
    const cleaned = cleanQuery(q);
    if (!cleaned) return [];
    let results = await searchHidoriStream(cleaned);
    if (results.length === 0) {
        const words = cleaned.split(' ').filter(w => w.length > 0);
        if (words.length > 3) {
            results = await searchHidoriStream(words.slice(0, 3).join(' '));
        }
    }
    return results;
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
    const { html } = await fetchWorkingDocument(animeUrl);
    
    let scope = "";
    const epStart = html.search(/class="[^"]*(?:eplister|bxcl|episodelist)[^"]*"/i);
    if (epStart >= 0) {
        const sub = html.slice(epStart);
        const epEnd = sub.search(/class="[^"]*(?:sidebar|widgets|footer|comment)[^"]*"/i);
        scope = epEnd > 0 ? sub.slice(0, epEnd) : sub.slice(0, 15000);
    }

    if (!scope) return [];

    const episodes = [];
    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(scope)) !== null) {
        const a = anchorsIn(m[1]).find(item => {
            const h = getAttr(item.tag, 'href') || '';
            return h.indexOf('episode') >= 0 || h.indexOf('/nonton-') >= 0;
        });
        if (!a) continue;
        const href = getAttr(a.tag, 'href');
        if (!href) continue;

        const rawTitle = stripTags(a.inner);
        const epMatch = rawTitle.match(/(?:episode|eps?|ep)\s*(\d+(?:\.\d+)?)/i) || href.match(/(?:episode|eps?|ep)-?(\d+(?:\.\d+)?)/i);
        
        episodes.push({
            title: rawTitle,
            episodeNum: epMatch ? parseFloat(epMatch[1]) : null,
            url: href
        });
    }

    const seen = new Set();
    const uniqueEpisodes = episodes.filter(e => {
        if (!e.url || seen.has(e.url)) return false;
        seen.add(e.url);
        return true;
    });

    return uniqueEpisodes.reverse();
}

function isHidoriDirectMedia(url) {
    const u = (url || '').toLowerCase();
    if (isSkippedHost(u)) return false;
    return (u.includes('.m3u8') || u.includes('.mp4') || u.includes('/stream-vid/')) &&
           (u.includes('storagehidori') || u.includes('stotagehidori') || u.includes('storeghido') || u.includes('ayokunjungi') || u.includes('hidoristream'));
}

function formatStreamObject(url, quality, pageUrl) {
    if (!isHidoriDirectMedia(url)) return null;
    const q = quality || getQualityFromUrl(url);
    const label = hostLabel(url);
    return {
        name: label,
        title: `${label} (${q})`,
        url: url,
        quality: q,
        headers: { "Referer": pageUrl, "User-Agent": USER_AGENT }
    };
}

async function extractStreamsFromEpisode(episodeUrl) {
    const { html, url: pageUrl } = await fetchWorkingDocument(episodeUrl);
    const streams = [];

    const downloadSectionRe = /<(?:div|ul|li|tr|option)\b[^>]*class="[^"]*(?:soraddl|soraurlx|dlbox|download|mirror|eplister)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|ul|li|tr|option)>/gi;
    let secMatch;
    while ((secMatch = downloadSectionRe.exec(html)) !== null) {
        const block = secMatch[1];
        const qInBlock = parseQualityText(block);

        for (const a of anchorsIn(block)) {
            const href = getAttr(a.tag, 'href') || getAttr(a.tag, 'value');
            if (href && href.startsWith('http')) {
                const obj = formatStreamObject(href, qInBlock, pageUrl);
                if (obj) streams.push(obj);
            }
        }
    }

    const iframeRe = /<iframe\b[^>]*>/gi;
    let ifm;
    while ((ifm = iframeRe.exec(html)) !== null) {
        const src = getAttr(ifm[0], 'data-litespeed-src') || getAttr(ifm[0], 'data-src') || getAttr(ifm[0], 'src');
        if (src && src.startsWith('http')) {
            const obj = formatStreamObject(src, null, pageUrl);
            if (obj) streams.push(obj);
        }
    }

    const mediaRe = /https?:\/\/[^"'\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\s<>]*)?/gi;
    let mrm;
    while ((mrm = mediaRe.exec(html)) !== null) {
        const url = mrm[0];
        const obj = formatStreamObject(url, null, pageUrl);
        if (obj) streams.push(obj);
    }

    const seen = new Set();
    return streams.filter(s => {
        if (!s || !s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

async function getAniListTitles(title) {
    try {
        const query = "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } synonyms } }";
        const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
            body: JSON.stringify({ query, variables: { search: title } })
        });
        const data = JSON.parse(await res.text());
        const media = data?.data?.Media;
        if (!media) return [];
        const t = media.title || {};
        const candidates = [t.romaji, t.english].concat(media.synonyms || []);
        return candidates.filter(v => v && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(v));
    } catch (e) {
        return [];
    }
}

async function tmdbGet(path) {
    const WORKER_URL = "https://kuroproxy.anjvsmara.workers.dev";
    const res = await fetch(`${WORKER_URL}/tmdb?path=` + encodeURIComponent(path), {
        headers: { "User-Agent": USER_AGENT }
    });
    return JSON.parse(await res.text());
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

async function getStreams(tmdbId, mediaType, season, episode) {
    mediaType = (mediaType === 'series' || mediaType === 'tv') ? 'tv' : 'movie';
    if (season === -1) season = null;
    if (episode === -1) episode = null;

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
            return [debugStream(`NOMATCH: ${info.title}`)];
        }

        const episodes = await getEpisodes(match.url);
        if (mediaType === 'movie') {
            const epUrl = episodes.length > 0 ? (episode && episodes.length >= episode ? episodes[episode - 1].url : episodes[0].url) : match.url;
            const streams = await extractStreamsFromEpisode(epUrl);
            return streams.length ? streams : [debugStream("NOSTREAM found for movie")];
        }

        const numbered = episodes.filter(e => e.episodeNum !== null);
        let target = numbered.find(e => e.episodeNum === episode);
        if (!target && episodes.length >= episode) {
            target = episodes[episode - 1];
        }

        if (!target) {
            return [debugStream(`NOEP: episode ${episode} tidak ditemukan (total ${episodes.length})`)];
        }

        const streams = await extractStreamsFromEpisode(target.url);
        return streams.length ? streams : [debugStream("NOSTREAM found for episode")];
    } catch (err) {
        return [debugStream(`ERROR: ${err.message}`)];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}