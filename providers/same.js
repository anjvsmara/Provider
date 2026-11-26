const BASE_URL = "https://v2.samehadaku.how";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const WANTED_QUALITIES = ["720p", "1080p"];
const TIMEOUT_MS = 10000;
const NON_LATIN_RE = /[^\u0000-\u024F\u1E00-\u1EFF\s]/;
;
const BLOGGER_ITAG_QUALITY = { 22: "720p", 37: "1080p", 46: "1080p", 59: "480p", 18: "360p" };

function debug(stage, detail) {
    if (typeof console !== "undefined" && console.log) {
        console.log("[Samehada] " + stage, detail === undefined ? "" : detail);
    }
}

function debugStream(msg) {
    return {
        name: String(msg).slice(0, 180),
        title: "DEBUG",
        url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
        quality: "360p"
    };
}

async function mapLimit(items, limit, worker) {
    const out = new Array(items.length);
    let next = 0;
    const count = Math.min(Math.max(1, limit | 0), items.length);
    await Promise.all(Array.from({length: count}, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            out[i] = await worker(items[i], i);
        }
    }));
    return out;
}

function timeoutSignal() {
    return (typeof AbortSignal !== "undefined" && AbortSignal.timeout) ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
}

async function fetchText(url, options) {
    const started = Date.now();
    const opts = options || {};
    try {
        const res = await fetch(url, {
            method: "GET",
            ...opts,
            signal: timeoutSignal(),
            headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) }
        });
        if (res.status >= 400) {
            debug("HTTP ERROR", res.status + " | " + (Date.now() - started) + "ms | " + url);
            throw new Error(`HTTP ${res.status} for ${url}`);
        }
        const body = await res.text();
        debug("HTTP", res.status + " | " + (Date.now() - started) + "ms | " + body.length + " chars | " + url);
        return body;
    } catch (e) {
        debug("FETCH ERROR", (Date.now() - started) + "ms | " + url + " | " + e.message);
        throw e;
    }
}

async function verifyPlayable(url, referer) {
    const started = Date.now();
    if (/\.(?:rar|zip|7z)(?:$|[?#])/i.test(String(url || ""))) {
        debug("VERIFY SKIP", "archive | " + url);
        return false;
    }
    try {
        const headers = { "User-Agent": USER_AGENT, "Range": "bytes=0-1" };
        if (referer) headers["Referer"] = referer;
        const res = await fetch(url, { method: "GET", headers: headers, signal: timeoutSignal() });
        const ct = String((res.headers && res.headers.get && res.headers.get("content-type")) || "").toLowerCase();
        if (res.body && typeof res.body.cancel === "function") {
            try { res.body.cancel().catch(() => {}); } catch (e) {}
        }
        let valid = false;
        let reason = "HTTP " + res.status;
        if (res.status === 200 || res.status === 206) {
            if (/text\/|json|javascript|xml|rar|zip|7z/.test(ct)) {
                reason = "non-media content-type: " + ct;
            } else if (/^video\/|mpegurl|matroska|octet-stream/.test(ct)) {
                valid = true;
                reason = "media: " + ct;
            } else if (ct === "" && /\.(mp4|mkv|m3u8|webm)(?:$|[?#])/i.test(url)) {
                valid = true;
                reason = "extension fallback";
            } else {
                reason = "unsupported content-type: " + ct;
            }
        }
        debug(valid ? "VERIFY OK" : "VERIFY NO", (Date.now() - started) + "ms | " + reason + " | " + url);
        return valid;
    } catch (e) {
        debug("VERIFY ERROR", (Date.now() - started) + "ms | " + e.message + " | " + url);
        return false;
    }
}
function decodeEntities(s) {
    return (s || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#039;|&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch (e) { return ""; } })
        .replace(/\\\//g, "/");
}

function stripTags(s) {
    return decodeEntities((s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function getAttr(tag, name) {
    const re = new RegExp("(?:^|\\s)" + name + "\\s*=\\s*[\"']([^\"']*)[\"']", "i");
    const m = (tag || "").match(re);
    return m ? decodeEntities(m[1]) : null;
}

function absoluteUrl(value) {
    const u = decodeEntities(String(value || "").trim());
    if (!u || /^(?:javascript:|data:|mailto:|#)/i.test(u)) return "";
    if (u.indexOf("//") === 0) return "https:" + u;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.charAt(0) === "/") return BASE_URL + u;
    return "";
}

function anchorsIn(html) {
    const out = [];
    const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        out.push({ tag: "<a" + m[1] + ">", inner: m[2], index: m.index });
    }
    return out;
}

function cleanTitle(s) {
    return (s || "")
        .replace(/\b(Sub(\s*)?(title)?\s*Indonesia|Subtitle\s*Indonesia|Sub\s*Indo)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
}

function stripEpisodeSuffix(s) {
    return (s || "").replace(/\s*\b(?:episode|eps?)\s*\d+(?:\.\d+)?\b.*$/i, "").trim();
}

function cleanPartSuffix(s) {
    return (s || "").replace(/\b(part|cour)\s*\d+\b/gi, "").trim();
}

function normalizeTitle(s) {
    return (s || "")
        .toLowerCase()
        .replace(/×/g, "x")
        .replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff01-\uff0f]+/g, "");
}

function latinTokens(s) {
    return (s || "")
        .toLowerCase()
        .replace(/×/g, "x")
        .split(/[^a-z0-9]+/)
        .filter(t => t.length > 0);
}

function seasonOf(title, url) {
    const t = ((title || "") + " " + (url || "")).toLowerCase();
    let m = t.match(/season[-_\s]*(\d+)/i) || t.match(/\bs(\d+)\b/i) || t.match(/-s(\d+)-/i);
    if (m) return parseInt(m[1], 10);
    m = t.match(/\b(\d+)(?:st|nd|rd|th)[-_\s]+season\b/i);
    if (m) return parseInt(m[1], 10);
    return null;
}

function partNumber(item) {
    const m = (item.title + " " + item.url).match(/\b(?:part|cour)[\s-]*(\d+)\b/i);
    if (m) return parseInt(m[1], 10);
    const s = seasonOf(item.title, item.url);
    return s || 1;
}



function cleanQuery(q) {
    return String(q || "")
        .replace(/×/g, "x")
        .replace(/[:.~!?'"’‘“”`\-–—]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function slugify(s) {
    return cleanQuery(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function showUrlFromEpisode(url) {
    const m = String(url || "").match(
        /^(https?:\/\/[^/]+)\/([^/]+)-episode-\d+(?:\.\d+)?(?:-[^/]*)?\/?$/i
    );
    if (!m || /^batch-/i.test(m[2])) return null;
    return m[1] + "/anime/" + m[2] + "/";
}


async function searchShows(query) {
    const url = BASE_URL + "/?s=" + encodeURIComponent(query).replace(/%20/g, "+");
    const html = await fetchText(url);
    const cards = html.match(/<article\b[^>]*class=["'][^"']*\banimepost\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi) || [];
    const seen = new Set();
    const shows = [];

    debug("Raw search cards", cards.map((card, i) => {
        const heading = card.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
        return {
            n: i + 1,
            title: heading ? stripTags(heading[1]) : "",
            links: anchorsIn(card).map(a =>
                getAttr(a.tag, "href") || ""
            ).filter(Boolean).slice(0, 5)
        };
    }));

    for (const card of cards) {
        const links = anchorsIn(card);
        let showUrl = null;

        for (const a of links) {
            const href = absoluteUrl(getAttr(a.tag, "href") || "");
            if (!href) continue;

            if (/\/anime\/[^/]+\/?$/i.test(href)) {
                showUrl = href.replace(/\/?$/, "/");
                break;
            }
        }

        if (!showUrl) {
            for (const a of links) {
                const href = absoluteUrl(getAttr(a.tag, "href") || "");
                if (!href || /\/batch\//i.test(href)) continue;
                const derived = showUrlFromEpisode(href);
                if (derived) {
                    showUrl = derived;
                    break;
                }
            }
        }

        if (!showUrl || seen.has(showUrl)) continue;

        const heading = card.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
        let raw = heading ? stripTags(heading[1]) : "";
        raw = cleanTitle(stripEpisodeSuffix(raw))
            .replace(/\[(?:END|BATCH)\]/gi, "")
            .trim();

        if (!raw) continue;

        seen.add(showUrl);
        shows.push({ title: raw, url: showUrl });
    }

    debug("Search parsed", {
        query: query,
        cards: cards.length,
        shows: shows.map(x => ({ title: x.title, url: x.url }))
    });
    return shows;
}

async function searchWithFallback(q) {
    const cleaned = cleanQuery(q);
    if (!cleaned || cleaned.toLowerCase() === "sesame" || NON_LATIN_RE.test(cleaned)) return [];
    let results = await searchShows(cleaned);
    if (results.length === 0) {
        const words = cleaned.split(" ").filter(w => w.length > 0);
        if (words.length > 3) {
            debug("SEARCH RETRY", words.slice(0, 3).join(" "));
            results = await searchShows(words.slice(0, 3).join(" "));
        }
    }
    return results;
}

function titleVariants(title, seasonNum) {
    const bases = [...new Set([title, cleanQuery(title)])];
    const out = [];
    for (const b of bases) {
        out.push(b);
        if (seasonNum > 1) {
            out.push(`${b} S${seasonNum}`, `${b} Season ${seasonNum}`);
        } else {
            out.push(`${b} Part 2`, `${b} Cour 2`);
        }
    }
    return [...new Set(out)];
}

async function probeShows(variants) {
    const unique = [];
    const seen = new Set();

    for (const v of variants) {
        const url = BASE_URL + "/anime/" + slugify(v) + "/";
        if (seen.has(url)) continue;
        seen.add(url);
        unique.push({ title: v, url: url });
    }

    const checked = await mapLimit(unique, 3, async item => {
        const started = Date.now();
        try {
            const html = await fetchText(item.url, {
                headers: { Referer: BASE_URL + "/" }
            });
            const byClass = /class="[^"]*(?:lstepsiode|lchx|eplister|episodelist)[^"]*"/i.test(html);
            const byLinks = html.toLowerCase().indexOf("/" + slugify(item.title) + "-episode") >= 0;

            if (byClass || byLinks) {
                debug("Probe hit", {
                    url: item.url,
                    byClass: byClass,
                    byLinks: byLinks,
                    ms: Date.now() - started
                });
                return { title: item.title, url: item.url };
            }

            debug("Probe miss", item.url + " | " + (Date.now() - started) + "ms");
        } catch (e) {
            debug("Probe error", item.url + " | " + e.message);
        }
        return null;
    });

    const hits = checked.filter(Boolean);
    debug("Probe summary", {
        attempted: unique.length,
        matched: hits.length,
        failedOrMissed: unique.length - hits.length
    });
    return hits;
}

const SEASON_WORDS = new Set(["season", "part", "cour", "final", "second", "third", "fourth", "ii", "iii", "iv"]);

function isSeasonExtension(itemTok, titleTok) {
    const titleSet = new Set(titleTok);
    const extras = itemTok.filter(w => !titleSet.has(w));

    if (extras.every(w =>
        SEASON_WORDS.has(w) ||
        /^\d+$/.test(w) ||
        /^s\d+$/.test(w) ||
        /^\d+(st|nd|rd|th)$/.test(w)
    )) return true;

    // Allow one franchise prefix before an exact title beginning with a number.
    return titleTok.length > 1 &&
        /^\d+$/.test(titleTok[0]) &&
        itemTok.length === titleTok.length + 1 &&
        /^[a-z]+$/.test(itemTok[0]) &&
        itemTok.slice(1).every((w, i) => w === titleTok[i]);
}

function findMatches(results, titles, season, mediaType) {
    const anySeason = season === "any";
    const want = anySeason ? null : (Number(season) > 1 ? Number(season) : 1);

    const all = results
        .map(r => ({
            title: r.title,
            url: r.url,
            key: normalizeTitle(r.title),
            baseKey: normalizeTitle(cleanPartSuffix(r.title)),
            tok: latinTokens(r.title),
            rawSeason: seasonOf(r.title, r.url),
            hasPart: /\b(?:part|cour)\s*\d+\b/i.test(r.title + " " + r.url)
        }))
        .filter(i => i.key)
        .filter(i => !(mediaType === "tv" && /\bmovie\b/i.test(i.title)));

    debug("SEASON AUDIT BEFORE FILTER", {
        requested: season,
        detected: all.map(i => ({
            title: i.title,
            season: i.rawSeason,
            url: i.url
        }))
    });

    let items = all;
    if (!anySeason) {
        if (want === 1) {
            items = all.filter(i => i.rawSeason === null || i.rawSeason === 1);
        } else {
            const exact = all.filter(i => i.rawSeason === want);
            items = exact.length > 0 ? exact : all.filter(i => i.rawSeason === null);
        }
    }

    const targets = titles
        .map(t => ({ key: normalizeTitle(t), tok: latinTokens(t) }))
        .filter(t => t.key);
    if (items.length === 0 || targets.length === 0) return [];

    const isTv = mediaType === "tv";
    const extOk = (item, target) => !isTv || isSeasonExtension(item.tok, target.tok);

    const matches = [];
    const seen = new Set();
    const add = (item) => {
        if (!seen.has(item.url)) {
            matches.push(item);
            seen.add(item.url);
        }
    };

    for (const t of targets) {
        for (const item of items) {
            if (item.key === t.key || item.baseKey === t.key) add(item);
        }
    }

    for (const t of targets) {
        if (t.key.length < 4) continue;
        for (const item of items) {
            if (item.key.length < 4) continue;
            const coversEnough = item.key.length >= 0.6 * t.key.length;
            const sub = (item.key.indexOf(t.key) >= 0 && coversEnough && extOk(item, t))
                || (t.key.indexOf(item.key) >= 0 && coversEnough)
                || (item.baseKey.indexOf(t.key) >= 0 && extOk(item, t));
            if (sub) add(item);
        }
    }

    for (const t of targets) {
        const tTok = [...new Set(t.tok)];
        if (tTok.length < 2) continue;
        for (const item of items) {
            const itemSet = new Set(item.tok);
            const shared = tTok.filter(w => itemSet.has(w)).length;
            const ratio = shared / tTok.length;
            if (shared >= 2 && ratio >= 0.5 && extOk(item, t)) add(item);
        }
    }

    return matches;
}

async function getEpisodes(showUrl) {
    const html = await fetchText(showUrl, { headers: { Referer: BASE_URL + "/" } });
    const slugMatch = showUrl.match(/\/anime\/([^/]+)\/?$/);
    const slug = (slugMatch ? slugMatch[1] : "").toLowerCase();
    const episodeMarker = slug ? "/" + slug + "-episode" : "";

    let scope = "";
    const start = html.search(/class="[^"]*lstepsiode[^"]*"/i);
    if (start >= 0) {
        const sub = html.slice(start);
        const end = sub.search(/id="comments"|class="[^"]*(?:sidebar|footer)[^"]*"/i);
        scope = end > 0 ? sub.slice(0, end) : sub.slice(0, 200000);
    }

    const episodes = [];
    const seen = new Set();

    const pushFrom = (anchor) => {
        const href = getAttr(anchor.tag, "href") || "";
        if (!/^https?:\/\//i.test(href) || !/episode/i.test(href) || /\/batch\//i.test(href)) return;
        if (episodeMarker && href.toLowerCase().indexOf(episodeMarker) < 0) return;
        if (seen.has(href)) return;
        seen.add(href);

        const rawTitle = stripTags(anchor.inner);
        const epMatch = rawTitle.match(/(?:episode|eps?|ep)\s*(\d+(?:\.\d+)?)/i) || href.match(/episode-?(\d+(?:\.\d+)?)/i);
        episodes.push({
            title: rawTitle,
            episodeNum: epMatch ? parseFloat(epMatch[1]) : null,
            url: href
        });
    };

    if (scope) {
        const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let m;
        while ((m = liRe.exec(scope)) !== null) {
            for (const a of anchorsIn(m[1])) pushFrom(a);
        }
    } else {
        for (const a of anchorsIn(html)) pushFrom(a);
    }

    debug("Parsed episode links", {
        showUrl: showUrl,
        count: episodes.length,
        items: episodes.slice(0, 15).map(e => ({
            episode: e.episodeNum,
            title: e.title,
            url: e.url
        }))
    });

    return episodes;
}

async function getAniListTitles(title) {
    try {
        const query = "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } synonyms } }";
        const res = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json", "User-Agent": USER_AGENT },
            body: JSON.stringify({ query: query, variables: { search: title } })
        });
        const data = JSON.parse(await res.text());
        const media = data && data.data && data.data.Media;
        if (!media) return [];
        const t = media.title || {};
        const candidates = [t.romaji, t.english].concat(media.synonyms || []);
        return candidates.filter(v => v && !NON_LATIN_RE.test(v));
    } catch (e) {
        return [];
    }
}

async function getKitsuAnime(id) {
    const url = "https://kitsu.io/api/edge/anime/" + encodeURIComponent(id);
    const res = await fetch(url, {
        headers: {
            "Accept": "application/vnd.api+json",
            "User-Agent": USER_AGENT
        }
    });

    if (!res.ok) {
        throw new Error("Kitsu HTTP " + res.status + " untuk ID " + id);
    }

    const json = await res.json();
    const a = json && json.data && json.data.attributes;
    if (!a) throw new Error("Data anime Kitsu tidak ditemukan: " + id);

    const rawTitles = [
        a.canonicalTitle,
        a.titles && a.titles.en,
        a.titles && a.titles.en_jp,
        a.titles && a.titles.en_us,
        ...(Array.isArray(a.abbreviatedTitles) ? a.abbreviatedTitles : [])
    ];

    const titles = [...new Set(rawTitles
        .filter(v => typeof v === "string" && v.trim())
        .map(v => v.trim())
        .filter(v => latinTokens(v).length > 0)
    )];

    const title = (a.canonicalTitle && latinTokens(a.canonicalTitle).length)
        ? a.canonicalTitle
        : titles[0];

    if (!title) throw new Error("Kitsu tidak menyediakan judul Latin untuk ID " + id);

    const seasonHint = rawTitles
        .filter(v => typeof v === "string")
        .map(v => seasonOf(v, ""))
        .find(v => v !== null) || null;

    return {
        title: title,
        titles: titles,
        seasonHint: seasonHint,
        subtype: String(a.subtype || "").toLowerCase(),
        episodeCount: Number(a.episodeCount) || 0,
        status: a.status || ""
    };
}

function qualityFrom(text) {
    const t = String(text || "").toLowerCase();
    const m = t.match(/\b(2160|1440|1080|720|480|360|240)\s*p?\b/);
    if (m) return m[1] + "p";
    if (/\b4k\b/.test(t)) return "2160p";
    if (/full\s*hd|fullhd/.test(t)) return "1080p";
    if (/mp4hd|\bhd\b/.test(t)) return "720p";
    return "Auto";
}

function getDownloadServers(html, pageUrl) {
    const out = [];
    const blocks = String(html || "").split(/<div class="download-eps" id="downloadb">/i).slice(1);

    for (const raw of blocks) {
        const block = raw.split(/<\/ul>/i)[0];
        const groupM = block.match(/<p>\s*<b>([\s\S]*?)<\/b>\s*<\/p>/i);
        const group = groupM ? stripTags(groupM[1]).split(" [")[0] : "";

        const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let li;
        while ((li = liRe.exec(block)) !== null) {
            const body = li[1];
            const strong = body.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i);
            const qualityText = strong ? stripTags(strong[1]) : "";
            const quality = qualityFrom(qualityText) !== "Auto" ? qualityFrom(qualityText) : qualityFrom(group);

            for (const a of anchorsIn(body)) {
                const url = absoluteUrl(getAttr(a.tag, "href"));
                if (!url) continue;
                out.push({
                    url: url,
                    label: stripTags(a.inner) || "Server",
                    quality: quality,
                    format: group
                });
            }
        }
    }
    return out;
}

function playerOptions(html) {
    const out = [];
    const re = /<div\b[^>]*east_player_option[^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const embed = getAttr(m[0], "data-embed") || "";
        const src = getAttr(embed, "src") || "";
        if (/^https?:\/\//i.test(src)) out.push(src);
    }
    return out;
}

function pixeldrainApi(url) {
    const m = String(url || "").match(/pixeldrain\.com\/u\/([A-Za-z0-9]+)/i);
    return m ? "https://pixeldrain.com/api/file/" + m[1] : null;
}

function embedPageFor(url) {
    const m = String(url || "").match(/^https?:\/\/(?:www\.)?filedon\.co\/view\/([A-Za-z0-9]+)/i);
    return m ? "https://filedon.co/embed/" + m[1] : null;
}

const SKIP_HOST_RE = /gofile\.io|mega\.nz|mediafire\.com|acefile\.co/i;

function domainOf(url) {
    const m = String(url || "").match(/^https?:\/\/(?:www\d*\.)?([^\/?#]+)/i);
    return m ? m[1].toLowerCase() : "server";
}

function hostKind(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes("pixeldrain.com/u/")) return "pixeldrain";
    if (/blogger\.com\/video\.g/.test(u)) return "blogger";
    if (embedPageFor(url)) return "embed";
    if (SKIP_HOST_RE.test(u)) return "skip";
    return "generic";
}

function genericCandidates(url) {
    const out = [url];
    if (/sharepoint\.com/i.test(url)) {
        out.push(url + (url.includes("?") ? "&" : "?") + "download=1");
    }
    return out;
}

function hostLabel(url) {
    const u = String(url || "").toLowerCase();
    if (u.includes("filedon")) return "Filedon";
    if (u.includes("pixeldrain")) return "Pixeldrain";
    if (u.includes("blogger")) return "Blogger";
    return domainOf(url);
}

function makeStream(label, url, quality, referer, formatHint) {
    var clean = String(url || "");
    try { clean = decodeURIComponent(clean); } catch (e) {}
    var path = clean.split(/[?#]/)[0];
    var tags = [];

    var isX265 = /x265/i.test(path + " " + String(formatHint || ""));
    if (isX265) {
        tags.push("x265");
    } else {
        var ext = path.match(/\.(mkv|mp4|webm|m3u8)$/i);
        if (ext) tags.push(ext[1].toUpperCase());
        else if (/pixeldrain\.com\/api\/file\//i.test(clean)) tags.push("MP4");
    }

    var suffix = tags.length ? " (" + tags.join(") (") + ")" : "";

    return {
        name: label + suffix,
        title: label + " - " + quality + suffix,
        url: url,
        quality: quality,
        headers: { "User-Agent": USER_AGENT, "Referer": referer }
    };
}

function bloggerFormats(html) {
    const src = String(html || "");
    const found = src.match(/https:\/\/[a-z0-9.-]+\.googlevideo\.com\/videoplayback[^\s"'<>]*/gi) || [];
    const seen = new Set();
    const out = [];
    for (const raw of found) {
        let u = raw.split(/&quot;|\\&quot;|\\"/)[0].replace(/\\+$/, "");
        u = u.replace(/\\u0026/gi, "&").replace(/\\u003d/gi, "=").replace(/&amp;/gi, "&");
        const itag = (u.match(/[?&]itag=(\d+)/) || [])[1];
        if (!itag || !BLOGGER_ITAG_QUALITY[itag]) continue;
        if (/[?&]sabr=1(?:&|$)/.test(u)) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        out.push({ url: u, quality: BLOGGER_ITAG_QUALITY[itag] });
    }
    return out;
}

async function bloggerStreams(pageUrl) {
    const html = await fetchText(pageUrl, { headers: { Referer: "https://www.blogger.com/" } });
    const formats = bloggerFormats(html);
    const itags = [...new Set((String(html).match(/itag=(\d+)/g) || []).map(s => s.slice(5)))];
    const wanted = formats.filter(f => WANTED_QUALITIES.includes(f.quality));
    if (wanted.length === 0) {
        debug("Blogger no 720/1080", { page: pageUrl, itags: itags, qualities: formats.map(f => f.quality), length: html.length });
        return [];
    }
    const out = [];
    for (const f of formats) {
        if (!WANTED_QUALITIES.includes(f.quality)) continue;
        if (await verifyPlayable(f.url, "https://www.blogger.com/")) {
            out.push(makeStream("Blogger", f.url, f.quality, "https://www.blogger.com/"));
        } else {
            debug("Blogger not playable", f.quality);
        }
    }
    return out;
}

const SKIP_URL_RE = /doubleclick|googletagmanager|googlesyndication|google-analytics|histats|facebook|twitter|instagram|disqus|fonts\.|jquery|bootstrap|\.(?:css|js|png|jpe?g|gif|svg|ico|webp)(?:$|[?#])/i;
const MEDIA_EXT_RE = /\.(?:m3u8|mp4|mkv|webm)(?:$|[?#"'\\\s])/i;
const MEDIA_HINT_RE = /cdn|stream|video|\/get\/|download|file|play/i;

function directMediaUrls(html, pageUrl) {
    const src = decodeEntities(String(html || "")).replace(/\\\//g, "/").replace(/\\u0026/gi, "&");
    const found = src.match(/https?:\/\/[^\s"'<>\\)]+/gi) || [];
    const primary = [];
    const hinted = [];
    const seen = new Set();
    for (const raw of found) {
        const u = raw.replace(/&(?:quot|#34|apos|#39|gt|#62);.*$/i, "").replace(/[,;]+$/, "");
        if (seen.has(u) || u === pageUrl) continue;
        seen.add(u);
        if (SKIP_URL_RE.test(u)) continue;
        if (MEDIA_EXT_RE.test(u)) primary.push(u);
        else if (MEDIA_HINT_RE.test(u)) hinted.push(u);
    }
    return primary.concat(hinted).slice(0, 6);
}

async function embedStreams(pageUrl, label, quality, referer, depth) {
    const level = depth || 0;
    const html = await fetchText(pageUrl, { headers: { Referer: referer } });
    const out = [];

    for (const u of directMediaUrls(html, pageUrl)) {
        if (await verifyPlayable(u, pageUrl)) {
            out.push(makeStream(label, u, quality, pageUrl));
        }
    }

    if (out.length === 0 && level < 1) {
        const iframes = [];
        const re = /<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi;
        let m;
        while ((m = re.exec(html)) !== null && iframes.length < 2) {
            const f = absoluteUrl(m[1]);
            if (f && f !== pageUrl) iframes.push(f);
        }
        for (const f of iframes) {
            const nested = await embedStreams(f, label, quality, pageUrl, level + 1);
            if (nested.length > 0) return nested;
        }
    }

    if (out.length === 0 && level === 0) {
        debug("Embed no playable", {
            page: pageUrl,
            length: html.length,
            scanned: directMediaUrls(html, pageUrl).length,
            hasVideoTag: /<video|<source/i.test(html),
            sample: directMediaUrls(html, pageUrl).slice(0, 3)
        });
    }
    return out;
}

async function extractStreamsFromEpisode(episodeUrl) {
    const html = await fetchText(episodeUrl, { headers: { Referer: BASE_URL + "/" } });
    const jobs = [];

    for (const d of getDownloadServers(html, episodeUrl)) {
        if (!WANTED_QUALITIES.includes(d.quality)) continue;
        const kind = hostKind(d.url);
        if (kind === "pixeldrain") {
            jobs.push({ kind: kind, label: "Pixeldrain", url: pixeldrainApi(d.url), quality: d.quality, format: d.format });
        } else if (kind === "embed") {
            jobs.push({ kind: kind, label: hostLabel(d.url), page: embedPageFor(d.url), quality: d.quality });
        } else if (kind === "blogger") {
            jobs.push({ kind: kind, label: "Blogger", url: d.url });
        } else if (kind === "generic") {
            jobs.push({ kind: kind, label: hostLabel(d.url), urls: genericCandidates(d.url), quality: d.quality, referer: d.url });
        } else {
            debug("Skip known unsupported host", d.url);
        }
    }

    for (const u of playerOptions(html)) {
        if (hostKind(u) === "blogger") jobs.push({ kind: "blogger", label: "Blogger", url: u });
    }

    debug("Host jobs", jobs.map(j => j.label + " " + (j.quality || "")));

    const jobResults = await mapLimit(jobs, 3, async job => {
        const found = [];
        const started = Date.now();

        try {
            if (job.kind === "pixeldrain") {
                if (job.url && await verifyPlayable(job.url, "https://pixeldrain.com/")) {
                    found.push(makeStream("Pixeldrain", job.url, job.quality, "https://pixeldrain.com/", job.format));
                } else {
                    debug("Pixeldrain not playable", job.url);
                }
            } else if (job.kind === "blogger") {
                found.push(...await bloggerStreams(job.url));
            } else if (job.kind === "embed") {
                found.push(...await embedStreams(job.page, job.label, job.quality, episodeUrl));
            } else if (job.kind === "generic") {
                for (const u of job.urls) {
                    if (await verifyPlayable(u, job.referer)) {
                        found.push(makeStream(
                            job.label,
                            u,
                            job.quality,
                            domainOf(u) === "server" ? BASE_URL + "/" : "https://" + domainOf(u) + "/"
                        ));
                        break;
                    }
                }
            }
        } catch (e) {
            debug("Host error", job.label + " | " + e.message);
        }

        debug("HOST DONE", job.label + " | " + found.length +
            " streams | " + (Date.now() - started) + "ms");
        return found;
    });

    const streams = [];
    const seen = new Set();

    for (const list of jobResults) {
        for (const stream of list) {
            if (!seen.has(stream.url) && WANTED_QUALITIES.includes(stream.quality)) {
                seen.add(stream.url);
                streams.push(stream);
            }
        }
    }

    // Prefer MP4 over regular MKV at the same quality.
    // Always retain x265 streams.
    const mp4Qualities = new Set(
        streams
            .filter(s => /\(MP4\)/i.test(s.name) && !/x265/i.test(s.name))
            .map(s => s.quality)
    );

    const filteredStreams = streams.filter(s => {
        const isX265 = /x265/i.test(s.name + " " + s.title);
        const isMkv = /\(MKV\)/i.test(s.name);
        if (isX265) return true;
        if (isMkv && mp4Qualities.has(s.quality)) return false;
        return true;
    });

    const has1080p = filteredStreams.some(s => s.quality === "1080p");

    const qualityFilteredStreams = has1080p
        ? filteredStreams.filter(s => s.quality !== "720p")
        : filteredStreams;

    debug("Format filter", {
        before: streams.length,
        after: filteredStreams.length,
        removed: streams.length - filteredStreams.length
    });

    debug("Quality priority", {
        has1080p: has1080p,
        before: filteredStreams.length,
        after: qualityFilteredStreams.length,
        removed720p: filteredStreams.length - qualityFilteredStreams.length
    });

    debug("Streams from episode", {
        episodeUrl: episodeUrl,
        count: qualityFilteredStreams.length
    });
    return qualityFilteredStreams;
}

async function streamsFromCourParts(pages, epNum) {
    const ordered = pages.slice().sort((a, b) => partNumber(a.match) - partNumber(b.match));
    let offset = 0;

    for (const page of ordered) {
        const sorted = page.episodes
            .filter(e => e.episodeNum !== null)
            .slice()
            .sort((a, b) => a.episodeNum - b.episodeNum);
        const idx = epNum - offset - 1;

        if (idx >= 0 && idx < sorted.length) {
            debug("Cour offset", { part: page.match.title, offset: offset, index: idx + 1 });
            const streams = await extractStreamsFromEpisode(sorted[idx].url);
            if (streams.length > 0) return streams;
        }

        offset += sorted.length;
    }

    return [];
}

async function streamsForPage(page, info, seasonNum, epNum) {
    const match = page.match;
    const episodes = page.episodes;
    const numbered = episodes.filter(e => e.episodeNum !== null);
    const relativeAllowed = seasonNum === 1 || match.rawSeason === seasonNum;
    let target = null;

    if (seasonNum > 1 && info.seasons) {
        const prevSum = Object.keys(info.seasons)
            .filter(k => Number(k) > 0 && Number(k) < seasonNum)
            .reduce((a, k) => a + info.seasons[k], 0);
        if (prevSum > 0) {
            const absEp = prevSum + epNum;
            target = numbered.find(e => e.episodeNum === absEp) || null;
        }
    }

    if (!target && relativeAllowed) {
        target = numbered.find(e => e.episodeNum === epNum) || null;
    }

    if (!target && relativeAllowed) {
        const sorted = numbered.slice().sort((a, b) => a.episodeNum - b.episodeNum);
        if (sorted.length >= epNum) target = sorted[epNum - 1];
    }

    if (!target) return { found: false, streams: [] };
    return { found: true, streams: await extractStreamsFromEpisode(target.url) };
}

async function getStreams(kitsuInput, mediaType, season, episode) {
    let failureStage = "INITIALIZATION";
    try {
        const raw = String(kitsuInput == null ? "" : kitsuInput).trim();
        const parsed = raw.match(/^(?:kitsu:)?(\d+)(?::(\d+(?:\.\d+)?))?$/i);

        if (!parsed) {
            throw new Error("Format ID harus kitsu:ID atau kitsu:ID:episode");
        }

        const kitsuId = parsed[1];
        const embeddedEpisode = parsed[2] ? Number(parsed[2]) : null;
        const epNum = embeddedEpisode || Number(episode);

        if (!Number.isFinite(epNum) || epNum <= 0) {
            throw new Error("Nomor episode tidak valid");
        }

        failureStage = "KITSU_METADATA";
        const info = await getKitsuAnime(kitsuId);

        // Kitsu IDs may represent an individual season, e.g. "Title Season 4".
        const requestedSeason = Number(season);
        const seasonNum = info.seasonHint ||
            (Number.isFinite(requestedSeason) && requestedSeason > 0
                ? requestedSeason
                : 1);

        mediaType = info.subtype === "movie" ? "movie" : "tv";

        failureStage = "ANILIST_METADATA";
        const baseTitle = info.title
            .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, " ")
            .replace(/\bseason\s*\d+\b/gi, " ")
            .trim();

        const aniListAliases = await getAniListTitles(info.title);
        const baseAniListAliases =
            normalizeTitle(baseTitle) !== normalizeTitle(info.title)
                ? await getAniListTitles(baseTitle)
                : [];

        const rootAliases = baseAniListAliases.map(v =>
            String(v).split(/\s+[-–—:]\s+/)[0].trim()
        );

        const searchTitles = [...new Set(
            info.titles.concat(
                aniListAliases,
                baseAniListAliases,
                rootAliases
            ).filter(v => v && latinTokens(v).length > 0)
        )];

        // Build search-friendly queries with automatic season variants.
        const searchQueries = [];
        const querySeen = new Set();

        const addSearchQuery = query => {
            query = String(query || "").replace(/\s+/g, " ").trim();
            const key = query.toLowerCase()
                .replace(/×/g, "x")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");
            if (query && key && !querySeen.has(key)) {
                querySeen.add(key);
                searchQueries.push(query);
            }
        };

        for (const title of [info.title, baseTitle].concat(searchTitles)) {
            let base = String(title || "")
                .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, " ")
                .replace(/\bseason\s*\d+\b/gi, " ")
                .replace(/\b(?:part|cour)\s*\d+\b/gi, " ")
                .replace(/\b(?:19|20)\d{2}\b/g, " ");

            base = latinTokens(base).join(" ").trim();
            if (!base) continue;

            addSearchQuery(base);

            if (seasonNum > 1) {
                addSearchQuery(base + " s" + seasonNum);
                addSearchQuery(base + " season " + seasonNum);
            }
        }
        debug("Kitsu metadata", {
            id: kitsuId,
            title: info.title,
            titles: searchTitles,
            season: seasonNum,
            subtype: info.subtype,
            episodes: info.episodeCount
        });

        debug("Search queries", searchQueries);

        failureStage = "SAMEHADAKU_SEARCH";
        let results = [];
        const activeQueries = searchQueries.slice(0, 7);
        const searchBatches = await mapLimit(
            activeQueries,
            3,
            async query => {
                const started = Date.now();
                const found = await searchWithFallback(query);
                debug("SEARCH DONE", query + " | " + found.length + " results | " + (Date.now() - started) + "ms");
                return found;
            }
        );
        for (const batch of searchBatches) {
            results = results.concat(batch || []);
        }

        // Deduplicate search results by URL.
        const resultSeen = new Set();
        results = results.filter(item => {
            if (!item || !item.url || resultSeen.has(item.url)) return false;
            resultSeen.add(item.url);
            return true;
        });

        debug("Samehadaku results", {
            total: results.length,
            list: results.slice(0, 12).map(r => r.title + " | " + r.url)
        });

        let candidates = findMatches(
            results,
            searchTitles,
            seasonNum,
            mediaType
        );

        if (candidates.length === 0) {
            debug("Search fallback", "Tidak ada kandidat; menjalankan probe");

            const probeVariants = [];
            for (const title of searchTitles.slice(0, 4)) {
                probeVariants.push(...titleVariants(title, seasonNum));
            }

            const probed = await probeShows(
                [...new Set(probeVariants)].slice(0, 10)
            );

            results = results.concat(probed);

            const resultSeenAfterProbe = new Set();
            results = results.filter(item => {
                if (!item || !item.url || resultSeenAfterProbe.has(item.url)) {
                    return false;
                }
                resultSeenAfterProbe.add(item.url);
                return true;
            });

            candidates = findMatches(
                results,
                searchTitles,
                seasonNum,
                mediaType
            );
        } else {
            debug("Search fallback", "Probe dilewati; kandidat search tersedia");
        }

        debug("Matched candidates", candidates.map(
            c => c.title + " | " + c.url
        ));

        if (candidates.length === 0) {
            debug("Kitsu search", "Tidak ada kandidat yang cocok");
            const title = searchTitles[0] || info.title || "judul dari Kitsu";
            const suggestions = results.slice(0, 3)
                .map(item => item.title).filter(Boolean);
            const context = " [Kitsu ID: " + kitsuId
                + " | Title: " + info.title
                + " | S" + seasonNum + "E" + epNum
                + " | Type: " + mediaType + "]";
            const message = (!results.length
                ? "Anime tidak ditemukan di Samehadaku: " + title
                : "Judul belum cocok di Samehadaku: " + title
                    + (suggestions.length
                        ? " | Kandidat pencarian: " + suggestions.join(" / ")
                        : "")) + context;
            return [debugStream(message)];
        }

        candidates = candidates
            .slice()
            .sort((a, b) => partNumber(a) - partNumber(b));

        if (mediaType === "movie") {
            for (const match of candidates) {
                const episodes = await getEpisodes(match.url);
                const epUrl = episodes.length
                    ? (episodes.length >= epNum
                        ? episodes[epNum - 1].url
                        : episodes[0].url)
                    : match.url;

                const streams = await extractStreamsFromEpisode(epUrl);
                if (streams.length) return streams;
            }
            debug("Kitsu result", "Film ditemukan tetapi belum ada stream");
            return [debugStream("Film ditemukan, tetapi link stream belum tersedia di Samehadaku")];
        }

        failureStage = "EPISODE_METADATA";
        const pages = await mapLimit(candidates, 3, async match => {
            const started = Date.now();
            const episodes = await getEpisodes(match.url);

            // A Kitsu entry can be a season-specific anime even when the
            // Samehadaku page title does not explicitly contain "Season N".
            const pageMatch = Object.assign({}, match);
            if (info.seasonHint && !pageMatch.rawSeason) {
                pageMatch.rawSeason = seasonNum;
            }

            debug("EPISODE PAGE", match.title + " | " + episodes.length +
                " episodes | " + (Date.now() - started) + "ms");

            return { match: pageMatch, episodes: episodes };
        });

        failureStage = "STREAM_CHECK";
        if (seasonNum === 1 && pages.length > 1) {
            const courStreams = await streamsFromCourParts(pages, epNum);
            if (courStreams.length) return courStreams;
        }

        let foundEpisode = false;

        for (const page of pages) {
            const result = await streamsForPage(
                page,
                info,
                seasonNum,
                epNum
            );

            if (result.found) foundEpisode = true;
            if (result.streams.length) return result.streams;
        }

        const failureMessage = foundEpisode
            ? "EPISODE_FOUND_NO_VERIFIED_STREAM: Episode ditemukan, tetapi tidak ada sumber media yang berhasil diverifikasi"
            : "Episode " + epNum + " belum tersedia di Samehadaku";
        debug("Kitsu result", failureMessage);
        return [debugStream(failureMessage)];
    } catch (err) {
        const detail = err && err.message ? err.message : String(err);
        const message = failureStage === "INITIALIZATION"
            ? "INPUT_OR_SETUP_ERROR: " + detail
            : "SOURCE_REQUEST_FAILED [" + failureStage + "]: " + detail;
        debug("Kitsu getStreams error", message);
        return [debugStream(message)];
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
