const t = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    n = ["mirrored.to", "dsvplay.com", "vidhidevip.com", "callistanise.com", "vidhidepro", "vidhide", "krakenfiles.com"],
    KIT_BASE_URL = "https://v10.hidoristream.online";

function i(t) { if (!t)
    return ""; const e = t.replace(/\s+/g, ""); try {
    if ("function" == typeof atob)
        return atob(e);
}
catch (t) { } try {
    return function (t) { let e = "", n = 0; for (; n < t.length;) {
        const i = t[n++];
        let r;
        r = i < 128 ? i : i >= 192 && i < 224 ? (31 & i) << 6 | 63 & t[n++] : i >= 224 && i < 240 ? (15 & i) << 12 | (63 & t[n++]) << 6 | 63 & t[n++] : (7 & i) << 18 | (63 & t[n++]) << 12 | (63 & t[n++]) << 6 | 63 & t[n++], r >= 65536 ? (r -= 65536, e += String.fromCharCode(55296 + (r >> 10), 56320 + (1023 & r))) : e += String.fromCharCode(r);
    } return e; }(function (t) { const e = []; let n = 0, i = 0; for (let r = 0; r < t.length; r++) {
        const s = t.charAt(r);
        if ("=" === s)
            break;
        const o = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(s);
        o < 0 || (n = 16777215 & (n << 6 | o), i += 6, i >= 8 && (i -= 8, e.push(n >> i & 255)));
    } return e; }(e));
}
catch (t) {
    return "";
} }

function r(t) { return { name: t.slice(0, 400), title: "DEBUG", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", quality: "360p" }; }

async function s(e, n) { const i = n || {}, r = "undefined" != typeof AbortSignal && AbortSignal.timeout ? AbortSignal.timeout(1e4) : void 0, s = await fetch(e, { ...i, signal: r, headers: { "User-Agent": t, ...i.headers || {} } }); if (s.status >= 400)
    throw new Error(`HTTP ${s.status} for ${e}`); return s.text(); }

function o(t) { return (t || "").replace(/&#(\d+);/g, (t, e) => { try {
    return String.fromCodePoint(Number(e));
}
catch (t) {
    return "";
} }).replace(/&#x([0-9a-f]+);/gi, (t, e) => { try {
    return String.fromCodePoint(parseInt(e, 16));
}
catch (t) {
    return "";
} }).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "); }

function a(t) { return o((t || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }

function l(t, e) { const n = new RegExp("(?:^|\\s)" + e + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"), i = (t || "").match(n); return i ? o(i[1]) : null; }

function c(t) { if (!t)
    return null; const e = String(t).match(/\b(2160|1440|1080|720|480|360|240)\s*p?\b/i); return e ? e[1] + "p" : null; }

function u(t) { return (t || "").replace(/\b(Sub(\s*)?(title)?\s*Indonesia|Subtitle\s*Indonesia|Sub\s*Indo)\b/gi, "").replace(/\s+/g, " ").trim(); }



function p(t) { const e = [], n = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let i; for (; null !== (i = n.exec(t));)
    e.push({ tag: "<a" + i[1] + ">", inner: i[2] }); return e; }

async function g(path) {
    const url = /^https?:\/\//i.test(path)
        ? path
        : KIT_BASE_URL.replace(/\/$/, "") + "/" + String(path || "").replace(/^\//, "");
    const html = await s(url, { headers: { Referer: KIT_BASE_URL + "/" } });
    return { html, url };
}

const y = new Map();
async function b(t) {
    const key = String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (y.has(key)) return y.get(key);

    const task = (async () => {
        const { html } = await g("/?s=" + encodeURIComponent(t));
        // Utamakan container kartu hasil, bukan wrapper induk .postbody.
        const listStart = html.search(/class=["'][^"']*\blistupd\b[^"']*["']/i);
        const fallbackStart = html.search(/class=["'][^"']*(?:postbody|result|main-content)[^"']*["']/i);
        const start = listStart >= 0 ? listStart : fallbackStart;
        let area = html;
        if (start >= 0) {
            const tail = html.slice(start);
            const stop = tail.search(/class=["'][^"']*(?:sidebar|widgets)[^"']*["']/i);
            area = stop > 0 ? tail.slice(0, stop) : tail.slice(0, 50000);
        }

        const out = [];
        const seen = new Set();
        const add = (href, title) => {
            if (!href || !/(?:\/anime\/|\/series\/)/i.test(href)) return;
            let clean = href;
            if (clean.startsWith("/")) clean = KIT_BASE_URL.replace(/\/$/, "") + clean;
            if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return;

            let name = u(title || "");
            if (!name) {
                let slug = clean.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
                try { slug = decodeURIComponent(slug); } catch (_) {}
                name = slug.replace(/[-_]+/g, " ");
            }
            name = name.replace(/\s+/g, " ").trim();
            if (name) {
                seen.add(clean);
                out.push({ title: name, url: clean });
            }
        };

        const articles = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
        let match;
        while ((match = articles.exec(area))) {
            const article = match[1];
            for (const link of p(article)) {
                const href = l(link.tag, "href") || "";
                if (!/(?:\/anime\/|\/series\/)/i.test(href)) continue;
                const imgAlt = (link.inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1];
                const heading = article.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)
                    || article.match(/<div[^>]*class="[^"]*\btt\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
                add(href, l(link.tag, "title") || a(heading ? heading[1] : "") || imgAlt || a(link.inner));
            }
        }

        // Fallback untuk tema yang tidak membungkus kartu hasil dengan elemen <article>.
        if (!out.length) {
            for (const link of p(area)) {
                const href = l(link.tag, "href") || "";
                if (!/(?:\/anime\/|\/series\/)/i.test(href)) continue;
                const imgAlt = (link.inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1];
                add(href, l(link.tag, "title") || imgAlt || a(link.inner));
            }
        }
        return out;
    })();

    y.set(key, task);
    if (y.size > 40) y.delete(y.keys().next().value);
    try {
        return await task;
    } catch (err) {
        y.delete(key);
        throw err;
    }
}

async function w(t) {
 const q=String(t||"").replace(/×/g,"x").replace(/\(\s*\d{4}\s*\)/g," ").replace(/[:.~!?'"’‘“”`\-–—]/g," ").replace(/\s+/g," ").trim();
 if(!q||/[\u3040-\u30ff\u4e00-\u9fff]/.test(q))return [];
 // Tidak memperlebar pencarian otomatis dengan tiga kata pertama.
 return b(q);
}

async function S(t, showCache) { const e = (showCache && showCache.get(t)) || (await g(t)).html; let n = ""; const i = e.search(/class="[^"]*(?:eplister|bxcl|episodelist)[^"]*"/i); if (i >= 0) {
    const t = e.slice(i), r = t.search(/class="[^"]*(?:sidebar|widgets|footer|comment)[^"]*"/i);
    n = r > 0 ? t.slice(0, r) : t.slice(0, 15e3);
} const r = []; if (!n)
    for (const t of p(e)) {
        const e = l(t.tag, "href") || "";
        if (!/episode|\/nonton-/i.test(e) || !e.startsWith("http"))
            continue;
        const n = a(t.inner), i = n.match(/(?:episode|eps?|ep)\s*(\d+(?:\.\d+)?)/i) || e.match(/episode-?(\d+(?:\.\d+)?)/i);
        r.push({ title: n, episodeNum: i ? parseFloat(i[1]) : null, url: e });
    } const s = /<li\b[^>]*>([\s\S]*?)<\/li>/gi; let o; for (; n && null !== (o = s.exec(n));) {
    const t = p(o[1]).find(t => { const e = l(t.tag, "href") || ""; return e.startsWith("http") && (e.indexOf("episode") >= 0 || e.indexOf("/nonton-") >= 0 || /\d/.test(a(t.inner))); });
    if (!t)
        continue;
    const e = l(t.tag, "href");
    if (!e)
        continue;
    const n = a(t.inner), i = n.match(/(?:episode|eps?|ep)\s*(\d+(?:\.\d+)?)/i) || e.match(/(?:episode|eps?|ep)-?(\d+(?:\.\d+)?)/i);
    r.push({ title: n, episodeNum: i ? parseFloat(i[1]) : null, url: e });
} const c = new Set; return r.filter(t => !(!t.url || c.has(t.url)) && (c.add(t.url), !0)); }

function x(t) { const e = (t || "").toLowerCase().trim(); if (!e.startsWith("http") || function (t) { const e = (t || "").toLowerCase(); return n.some(t => e.indexOf(t) >= 0); }(e))
    return !1; return !!(e.includes("hidoristream") || e.includes("ayokunjungi") || e.includes("storagehidori") || e.includes("stotagehidori") || e.includes("storeghido") || e.includes("createmyakun123")) && (!(/\/stream\/?$/i.test(e) || /\/files\/?$/i.test(e) || /\/media\/?$/i.test(e) || /\/stream-vid\/?$/i.test(e)) && (e.includes(".m3u8") || e.includes(".mp4") || /\/stream\/[a-z0-9_-]+/i.test(e) || /\/stream-vid\/[a-z0-9_-]+/i.test(e) || /\/files\/[a-z0-9_-]+/i.test(e) || /\/media\/[a-z0-9_-]+/i.test(e))); }

function k(e, n, i) { if (!x(e))
    return null; const r = n || function (t) { const e = (t || "").match(/(?:_|\/|\.|\b)(2160|1440|1080|720|480|360|240)(?:p|_|\/|\.|\b)/i); return e ? e[1] + "p" : "Auto"; }(e), s = function (t) { const e = (t || "").toLowerCase(); return e.includes("ayokunjungi") ? "Hidori (Server 1)" : e.includes("storeghido") || e.includes("stotagehidori") || e.includes("storagehidori") ? "Hidori (Server 2)" : "Hidori Direct"; }(e); return { name: s, title: `${s} (${r})`, url: e, quality: r, headers: { Referer: i, "User-Agent": t } }; }

async function $(t) { const { html: e, url: n } = await g(t), r = []; let s = e; const o = /<option[^>]+value=["']([A-Za-z0-9+/=]{20,})["']/gi; let u; for (; null !== (u = o.exec(e));) {
    const t = i(u[1]);
    t && t.includes("http") && (s += "\n" + t);
} const f = /<(?:div|tr|li|p)\b[^>]*class="[^"]*(?:soraddl|soraurlx|dlbox|download|mirror|server)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|tr|li|p)>/gi; let d; for (; null !== (d = f.exec(s));) {
    const t = d[1], e = c(t);
    for (const i of p(t)) {
        const t = l(i.tag, "href") || l(i.tag, "value");
        if (t && t.startsWith("http")) {
            const s = k(t, c(a(i.inner)) || e, n);
            s && r.push(s);
        }
    }
} const h = /<option\b[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi; let m; for (; null !== (m = h.exec(s));) {
    let t = m[1].trim();
    const e = c(a(m[2])) || c(t);
    if (t.startsWith("http")) {
        const i = k(t, e, n);
        i && r.push(i);
    }
} const y = /<iframe\b[^>]*>/gi; let b; for (; null !== (b = y.exec(s));) {
    const t = l(b[0], "data-litespeed-src") || l(b[0], "data-src") || l(b[0], "src");
    if (t && t.startsWith("http")) {
        const e = k(t, null, n);
        e && r.push(e);
    }
} const w = /https?:\/\/[^"'\s<>]+?(?:\.m3u8|\.mp4|\/stream\/[a-zA-Z0-9_-]+|\/stream-vid\/[a-zA-Z0-9_-]+|\/files\/[a-zA-Z0-9_-]+|\/media\/[a-zA-Z0-9_-]+)(?:\?[^"'\s<>]*)?/gi; let v; for (; null !== (v = w.exec(s));) {
    const t = k(v[0], null, n);
    t && r.push(t);
} const S = new Map; for (const t of r) {
    if (!t || !t.url)
        continue;
    const e = t.url.trim().replace(/\/$/, "");
    if (S.has(e)) {
        "Auto" === S.get(e).quality && "Auto" !== t.quality && S.set(e, t);
    }
    else
        S.set(e, t);
} return Array.from(S.values()); }

const KIT_SEA = /(?:\b(\d+)(?:st|nd|rd|th)\s+season\b)|(?:\bseason\s*(\d+)\b)|(?:第\s*(\d+)\s*期)/i;
function KIT_SEASON(t) {
    const value = String(t || "");
    const numeric = value.match(KIT_SEA);
    if (numeric)
        return Number(numeric[1] || numeric[2] || numeric[3]);
    const roman = value.match(/\b(II|III|IV|V)\s*$/i);
    if (!roman)
        return null;
    return ({ II: 2, III: 3, IV: 4, V: 5 })[roman[1].toUpperCase()];
}
function KIT_TRAILING_SEASON(t) {
    const match = String(t || "").match(/\s+(\d+)\s*$/);
    return match ? Number(match[1]) : null;
}
function KIT_BASE(t, confirmedSeason) {
    let value = String(t || "");
    if (confirmedSeason != null && KIT_TRAILING_SEASON(value) === Number(confirmedSeason))
        value = value.replace(/\s+\d+\s*$/, " ");
    return value
        .replace(/\(\s*\d{4}\s*\)/g, " ")
        .replace(/thousand[\s-]*year[\s-]*blood[\s-]*war/gi, " sennen kessen hen ")
        .replace(/\b\d+(?:st|nd|rd|th)\s+season\b|\bseason\s*\d+\b|\bpart\s*\d+\b|subtitle\s*indonesia|sub\s*indo/gi, " ")
        .replace(/\s+\b(?:II|III|IV|V)\s*$/i, " ")
        .replace(/第\s*\d+\s*期/g, " ")
        .replace(/[:.~!?'"’‘“”\x60\-–—,]/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
}
function KIT_QUERY(t) {
    // Normalisasi format season ordinal dan angka Romawi ke format pencarian situs.
    return String(t || "")
        .replace(/\b(\d+)(?:st|nd|rd|th)\s+season\b/gi, "Season $1")
        .replace(/\b(II|III|IV|V)\s*$/i, (_, roman) => "Season " + ({ II: 2, III: 3, IV: 4, V: 5 })[roman.toUpperCase()])
        .replace(/thousand[\s-]*year[\s-]*blood[\s-]*war/gi, "Sennen Kessen-hen");
}
function KIT_KEY(x) { return String(x || "").replace(/\s+/g, ""); }
// Pencocokan judul dua arah: kata entri harus ada di halaman, dan kata halaman harus ada di entri.
// Ini mencegah "Naruto" cocok dengan "Boruto: Naruto Next Generations" atau "Naruto Shippuden".
// Judul yang sama persis (abaikan spasi/tanda baca) selalu diterima.
function KIT_PICK(results, titles, requestState) {
    const explicitSeason = titles.map(KIT_SEASON).find(x => x != null) ?? null;
    const trailingSeasons = titles.map(KIT_TRAILING_SEASON).filter(x => x != null);
    const full = new Map();
    let best = null;

    requestState.ambig = null;
    requestState.bestScore = 0;

    for (const item of results) {
        const pageSeason = KIT_SEASON(item.title);
        const candidateSeason = pageSeason ?? KIT_TRAILING_SEASON(item.title);

        if (explicitSeason != null &&
            !(candidateSeason === explicitSeason ||
              (candidateSeason == null && explicitSeason === 1))) continue;

        if (explicitSeason == null && trailingSeasons.length &&
            !trailingSeasons.includes(candidateSeason)) continue;

        const bases = titles.map(title => {
            const trailing = KIT_TRAILING_SEASON(title);
            const confirmed = trailing != null && trailing === candidateSeason
                ? trailing : null;
            return KIT_BASE(title, confirmed);
        }).filter(Boolean);

        const pageBase = KIT_BASE(item.title, candidateSeason);
        if (!pageBase) continue;

        const pageKey = KIT_KEY(pageBase);
        const pageWords = [...new Set(pageBase.split(" ").filter(Boolean))];
        const pageSet = new Set(pageWords);

        for (const base of bases) {
            const baseKey = KIT_KEY(base);
            const baseWords = [...new Set(base.split(" ").filter(Boolean))];
            let score = 0;

            if (baseKey === pageKey) {
                score = 1;
            } else {
                if (baseWords.length < 2 || pageWords.length < 2) continue;
                const baseSet = new Set(baseWords);
                const a = baseWords.filter(w => pageSet.has(w)).length / baseWords.length;
                const b = pageWords.filter(w => baseSet.has(w)).length / pageWords.length;
                if (a < 0.9 || b < 0.9) continue;
                score = Math.min(a, b);
            }

            if (score === 1 && !full.has(item.url))
                full.set(item.url, item);
            if (!best || score > best.score)
                best = { item, score };
        }
    }

    if (full.size > 1) {
        requestState.ambig = [...full.values()];
        return null;
    }

    if (best) requestState.bestScore = best.score;
    return best && best.score >= 0.9 ? best.item : null;
}

const KIT_OVERRIDE = {
    "11": "Naruto Kecil",
};
async function KIT_TITLES(kitId) {
    if (KIT_OVERRIDE[kitId])
        return [KIT_OVERRIDE[kitId]];
    const at = JSON.parse(await s("https://kitsu.io/api/edge/anime/" + kitId)).data.attributes || {};
    const names = at.titles || {};
    const cand = [names.en_jp, at.canonicalTitle, names.en].concat(at.abbreviatedTitles || [])
        .filter(x => x && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(x));
    return [...new Set(cand)];
}
function KIT_SHORT_QUERY(title) {
    const raw = String(title || "").trim();
    if (!raw) return "";
    const colon = raw.indexOf(":");
    if (colon > 0) {
        const head = raw.slice(0, colon).trim();
        if (head.split(/\s+/).length >= 4) return head;
    }
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length >= 9) {
        const prefix = words.slice(0, 7).join(" ");
        const season = KIT_SEASON(raw);
        return season != null && KIT_SEASON(prefix) == null ? prefix + " Season " + season : prefix;
    }
    return "";
}
async function KIT_SEARCH(titles) {
    const showCache = new Map(), results = [], seenUrl = new Set();
    const requestState = { ambig: null, bestScore: 0 };
    const merge = batches => {
        for (const found of batches) for (const item of found || []) {
            if (item.url && !seenUrl.has(item.url)) { seenUrl.add(item.url); results.push(item); }
        }
    };
    const runQueries = async queries => {
        const unique = [], seen = new Set();
        for (const value of queries) {
            const q = String(value || "").trim();
            const key = q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            if (q && key && !seen.has(key)) { seen.add(key); unique.push(q); }
            if (unique.length >= 4) break;
        }
        if (!unique.length) return null;
        merge(await Promise.all(unique.map(query => w(query))));
        const pick = KIT_PICK(results, titles, requestState);
        return requestState.ambig || (pick && requestState.bestScore >= 0.999)
            ? { results, pick, ambig: requestState.ambig, showCache } : null;
    };
    // Cari semua nama Kitsu asli sebelum mencoba query yang diubah.
    let found = await runQueries(titles.slice(0, 4));
    if (found) return found;
    // Query pendek hanya menjadi fallback; tidak menggantikan judul lengkap.
    const fallback = [];
    for (const title of titles) {
        const normalized = KIT_QUERY(title);
        if (normalized && normalized !== title) fallback.push(normalized);
        const shortened = KIT_SHORT_QUERY(title);
        if (shortened) fallback.push(shortened);
    }
    found = await runQueries(fallback);
    if (found) return found;
    const pick = KIT_PICK(results, titles, requestState);
    return { results, pick, ambig: requestState.ambig, showCache };
}
function KIT_DEBUG(results, titles) {
    const entrySeason = KIT_ENTRY_SEASON(titles);
    const season = entrySeason == null ? 1 : entrySeason;
    const key = KIT_KEY(KIT_BASE(titles[0] || "", season)).slice(0, 32);
    const cands = results.slice(0, 3).map(r => {
        const pageSeason = KIT_SEASON(r.title);
        const candidateSeason = pageSeason ?? KIT_TRAILING_SEASON(r.title);
        const pageKey = KIT_KEY(KIT_BASE(r.title, candidateSeason)).slice(0, 32);
        return r.title.slice(0, 34) + "{s=" + candidateSeason + ",k=" + pageKey + "}";
    });
    return " judul=[" + titles.slice(0, 2).map(x => x.slice(0, 40)).join(" | ") + "] hasil=" + results.length
        + " | entri: s=" + season + " k=" + key + " | kandidat: " + cands.join(" ");
}
// Ambil daftar "Judul:" (judul alternatif, termasuk Inggris) dari halaman anime Kuronime.
function KIT_ALT_TEXT(html) {
    const text = String(html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ");
    const hit = text.match(/\bJudul\s*:/i);
    if (!hit)
        return "";
    const rest = text.slice(hit.index + hit[0].length);
    const stop = rest.search(/\b(?:Genre|Status|Studio|Tayang|Season|Tipe|Durasi|Released|Updated)\s*:/i);
    return KIT_KEY(KIT_BASE(stop < 0 ? rest.slice(0, 400) : rest.slice(0, stop)));
}
function KIT_ENTRY_SEASON(titles) {
    return titles.map(KIT_SEASON).find(x => x != null) ?? null;
}
// Dipakai hanya jika pencocokan judul utama gagal: buka maksimal 2 kandidat yang season-nya cocok,
// lalu cek apakah daftar "Judul:" halamannya memuat judul Kitsu (termasuk judul Inggris).
async function KIT_VERIFY(results, titles, showCache) {
    const entrySeason = KIT_ENTRY_SEASON(titles);
    const want = [...new Set(titles.map(t => KIT_KEY(KIT_BASE(t))).filter(k => k.length >= 8))];
    if (!want.length)
        return null;
    const cands = results.filter(r => {
        const ps = KIT_SEASON(r.title);
        return entrySeason == null || ps === entrySeason || (ps == null && entrySeason === 1);
    }).slice(0, 2);
    // Verifikasi maksimal dua kandidat secara paralel agar fallback tidak menambah
    // waktu tunggu berurutan. Hasil HTML tetap disimpan untuk dipakai ulang oleh S().
    const checked = await Promise.all(cands.map(async r => {
        try {
            const html = (await g(r.url)).html;
            showCache.set(r.url, html);
            const alt = KIT_ALT_TEXT(html);
            return want.some(k => alt.includes(k)) ? r : null;
        }
        catch (err) {
            return null;
        }
    }));
    const hits = checked.filter(Boolean);
    if (hits.length > 1)
        return { ambiguous: hits };
    return hits.length === 1 ? { item: hits[0] } : null;
}
async function KIT(raw, epParam) {
    try {
        const mm = String(raw).match(/^kitsu:(\d+)(?::(\d+))?/i);
        const ep = mm[2] ? Number(mm[2]) : (epParam == null ? null : Number(epParam));
        if (!ep)
            return [r("[v16] NOMATCH: kitsu:" + mm[1] + " tidak punya nomor episode")];
        const titles = await KIT_TITLES(mm[1]);
        const search = await KIT_SEARCH(titles);
        const res = search.results;
        let pick = search.pick;
        if (!pick && search.ambig)
            return [r("[v16] NOMATCH: kitsu:" + mm[1] + " ambigu, sama-sama cocok persis: " + search.ambig.map(x => x.title.slice(0, 40)).join(" | ") + ". Periksa judul alternatif Kitsu")];
        if (!pick) {
            const verified = await KIT_VERIFY(res, titles, search.showCache);
            if (verified && verified.ambiguous)
                return [r("[v16] NOMATCH: kitsu:" + mm[1] + " ambigu setelah verifikasi: " + verified.ambiguous.map(x => x.title.slice(0, 40)).join(" | ") + ". Periksa judul alternatif Kitsu")];
            pick = verified && verified.item;
        }
        if (!pick)
            return [r("[v16] NOMATCH: kitsu:" + mm[1] + KIT_DEBUG(res, titles))];
        const eps = await S(pick.url, search.showCache);
        const hit = eps.find(x => x.episodeNum === ep);
        if (!hit)
            return [r("[v16] NOEP: episode " + ep + " tidak ada di " + pick.title + " (" + eps.length + " episode)")];
        const st = await $(hit.url);
        return st.length ? st : [r("[v16] NOSTREAM: " + hit.url)];
    }
    catch (e) {
        return [r("[v16] NOMATCH: kitsu gagal diambil (" + e.message + ")")];
    }
}
async function _(id, type, season, episode) {
    if (String(type) === "movie") {
        return [r("[v16] NOMATCH: film belum didukung. Skrip ini hanya untuk serial kitsu")];
    }
    if (!/^kitsu:/i.test(String(id))) {
        return [r("[v16] NOMATCH: ID " + id + " bukan kitsu. Hanya ID kitsu yang didukung")];
    }
    return await KIT(id, episode);
}

"undefined" != typeof module && module.exports
  ? (module.exports = { getStreams: _ })
  : (global.getStreams = _);
