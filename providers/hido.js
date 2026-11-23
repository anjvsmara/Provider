const t = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36", e = ["https://v10.hidoristream.online", "https://v8.hidoristream.online", "https://hidoristream.com", "https://hidoristream.my.id", "https://v4.hidoristream.online", "https://v3.hidoristream.online", "https://v2.hidoristream.online", "https://v1.hidoristream.online"], n = ["mirrored.to", "dsvplay.com", "vidhidevip.com", "callistanise.com", "vidhidepro", "vidhide", "krakenfiles.com"];

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

let m = null;

async function g(t) { const n = t.startsWith("http"), i = m ? [m].concat(e.filter(t => t !== m)) : e, r = n ? [t] : i.map(e => e.replace(/\/$/, "") + "/" + t.replace(/^\//, "")); let o = null; for (const t of r)
    try {
        const e = await s(t, { headers: { Referer: "https://v8.hidoristream.online" } });
        return n || (m = t.match(/^https?:\/\/[^\/]+/)[0]), { html: e, url: t };
    }
    catch (t) {
        o = t;
    } throw new Error("Gagal mengambil halaman dari semua domain HidoriStream" + (o ? " (terakhir: " + o.message + ")" : ".")); }

let y = new Map;

async function b(t) { if (y.has(t))
    return y.get(t); const e = async function (t) { const e = encodeURIComponent(t), { html: n } = await g(`/?s=${e}`); let i = ""; const r = n.search(/class="[^"]*(?:listupd|postbody|result|main-content)[^"]*"/i); if (r >= 0) {
    const t = n.slice(r), e = t.search(/class="[^"]*(?:sidebar|widgets)[^"]*"/i);
    i = e > 0 ? t.slice(0, e) : t.slice(0, 3e4);
}
else
    i = n; const s = [], o = /<article\b[^>]*>([\s\S]*?)<\/article>/gi; let c; for (; null !== (c = o.exec(i));) {
    const t = c[1], e = p(t).find(t => { const e = l(t.tag, "href") || ""; return e.indexOf("/anime/") >= 0 || e.indexOf("/series/") >= 0; });
    if (!e)
        continue;
    const n = l(e.tag, "href"), i = u(a((t.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) || t.match(/<div[^>]*class="[^"]*\btt\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || [])[0]) || l(e.tag, "title") || a(e.inner));
    i && n && s.push({ title: i, url: n });
} const f = new Set; return s.filter(t => !f.has(t.url) && (f.add(t.url), !0)); }(t); y.set(t, e); try {
    return await e;
}
catch (e) {
    throw y.delete(t), e;
} }

async function w(t) { const e = function (t) { return String(t || "").replace(/×/g, "x").replace(/\(\s*\d{4}\s*\)/g, " ").replace(/[:.~!?'"’‘“”`\-–—]/g, " ").replace(/\s+/g, " ").trim(); }(t); if (!e || /[\u3040-\u30ff\u4e00-\u9fff]/.test(e))
    return []; let n = await b(e); if (0 === n.length) {
    const t = e.split(" ").filter(t => t.length > 0);
    t.length > 3 && (n = await b(t.slice(0, 3).join(" ")));
} return n; }

async function S(t) { const e = KIT_SHOW_CACHE.get(t) || (await g(t)).html; let n = ""; const i = e.search(/class="[^"]*(?:eplister|bxcl|episodelist)[^"]*"/i); if (i >= 0) {
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
function KIT_SEASON(t) { const q = String(t || "").match(KIT_SEA); return q ? Number(q[1] || q[2] || q[3]) : null; }
function KIT_BASE(t) {
    return String(t || "")
        .replace(/\(\s*\d{4}\s*\)/g, " ")
        // Situs memakai nama "Sennen Kessen-hen", Kitsu memakai "Thousand-Year Blood War".
        .replace(/thousand[\s-]*year[\s-]*blood[\s-]*war/gi, " sennen kessen hen ")
        .replace(/\b\d+(?:st|nd|rd|th)\s+season\b|\bseason\s*\d+\b|\bpart\s*\d+\b|subtitle\s*indonesia|sub\s*indo/gi, " ")
        .replace(/第\s*\d+\s*期/g, " ")
        .replace(/[:.~!?'"’‘“”`\-–—,]/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();
}
function KIT_QUERY(t) {
    // Varian query untuk pencarian situs: "2nd Season" -> "Season 2", dan nama TYBW -> "Sennen Kessen-hen".
    return String(t || "")
        .replace(/\b(\d+)(?:st|nd|rd|th)\s+season\b/gi, "Season $1")
        .replace(/thousand[\s-]*year[\s-]*blood[\s-]*war/gi, "Sennen Kessen-hen");
}

function KIT_KEY(x) { return String(x || "").replace(/\s+/g, ""); }
// Pencocokan judul dua arah: kata entri harus ada di halaman, dan kata halaman harus ada di entri.
// Ini mencegah "Naruto" cocok dengan "Boruto: Naruto Next Generations" atau "Naruto Shippuden".
// Judul yang sama persis (abaikan spasi/tanda baca) selalu diterima.
function KIT_PICK(results, titles) {
    const entrySeason = titles.map(KIT_SEASON).find(x => x != null) || 1;
    const bases = [...new Set(titles.map(KIT_BASE).filter(Boolean))];
    let best = null;
    // Kandidat yang cocok penuh (exact, atau semua kata sama), dikelompokkan per judul dasar.
    const full = new Map();
    KIT_AMBIG = null;
    for (const r of results) {
        const ps = KIT_SEASON(r.title);
        if (!(ps === entrySeason || (ps == null && entrySeason === 1)))
            continue;
        const rb = KIT_BASE(r.title);
        if (!rb)
            continue;
        const rKey = KIT_KEY(rb);
        const rWords = rb.split(" ");
        const rSet = new Set(rWords);
        for (const b of bases) {
            let score;
            if (KIT_KEY(b) === rKey) {
                score = 3;
            }
            else {
                const bWords = b.split(" ");
                const bSet = new Set(bWords);
                const entryInPage = bWords.filter(w => rSet.has(w)).length / bWords.length;
                const pageInEntry = rWords.filter(w => bSet.has(w)).length / rWords.length;
                if (entryInPage < 0.8 || pageInEntry < 0.8)
                    continue;
                score = Math.min(entryInPage, pageInEntry);
            }
            if (score >= 0.999 && !full.has(rKey))
                full.set(rKey, r);
            if (!best || score > best.score)
                best = { item: r, score };
        }
    }
    // Dua pertunjukan berbeda sama-sama cocok penuh (misal dua cour dalam satu entri Kitsu):
    // jangan menebak, laporkan sebagai ambigu.
    if (full.size >= 2) {
        KIT_AMBIG = [...full.values()];
        return null;
    }
    return best ? best.item : null;
}

const KIT_OVERRIDE = {
    "11": "Naruto Kecil",
    // Judul halaman di situs (Kuronime): "Bleach: Sennen Kessen-hen Final Part Sub Indo".
    // Tebakan lama "... - The Calamity" tidak ada di situs, makanya selalu NOMATCH.
    "49444": "Bleach: Sennen Kessen-hen Final Part",
};
// Dipakai KIT_PICK untuk melaporkan kandidat yang sama-sama cocok persis (ambigu).
let KIT_AMBIG = null;

async function KIT_TITLES(kitId) {
    if (KIT_OVERRIDE[kitId])
        return [KIT_OVERRIDE[kitId]];
    const at = JSON.parse(await s("https://kitsu.io/api/edge/anime/" + kitId)).data.attributes || {};
    const names = at.titles || {};
    const cand = [names.en_jp, at.canonicalTitle, names.en].concat(at.abbreviatedTitles || [])
        .filter(x => x && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(x));
    return [...new Set(cand)];
}
async function KIT_SEARCH(titles) {
    // Query dianggap sama jika hanya beda huruf besar-kecil/spasi (situs tidak case-sensitive).
    const seen = new Set();
    const queries = [];
    for (const q of titles.flatMap(x => [x, KIT_QUERY(x)])) {
        const key = q.toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        queries.push(q);
    }
    const parts = await Promise.all(queries.slice(0, 4).map(q => w(q)));
    const seenUrl = new Set();
    return [].concat(...parts).filter(x => !seenUrl.has(x.url) && seenUrl.add(x.url));
}
function KIT_DEBUG(results, titles) {
    const entrySeason = titles.map(KIT_SEASON).find(x => x != null) || 1;
    const key = KIT_KEY(KIT_BASE(titles[0] || "")).slice(0, 26);
    const cands = results.slice(0, 3).map(r => r.title.slice(0, 28) + "{s=" + KIT_SEASON(r.title) + ",k=" + KIT_KEY(KIT_BASE(r.title)).slice(0, 26) + "}");
    return " judul=[" + titles.slice(0, 2).map(x => x.slice(0, 40)).join(" | ") + "] hasil=" + results.length
        + " | entri: s=" + entrySeason + " k=" + key + " | kandidat: " + cands.join(" ");
}
// Cache halaman anime per pemanggilan KIT (dipakai ulang oleh _ agar tidak diambil dua kali).
let KIT_SHOW_CACHE = new Map();
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
    return titles.map(KIT_SEASON).find(x => x != null) || 1;
}
// Dipakai hanya jika pencocokan judul utama gagal: buka maksimal 2 kandidat yang season-nya cocok,
// lalu cek apakah daftar "Judul:" halamannya memuat judul Kitsu (termasuk judul Inggris).
async function KIT_VERIFY(results, titles) {
    const entrySeason = KIT_ENTRY_SEASON(titles);
    const want = [...new Set(titles.map(t => KIT_KEY(KIT_BASE(t))).filter(k => k.length >= 8))];
    if (!want.length)
        return null;
    const cands = results.filter(r => {
        const ps = KIT_SEASON(r.title);
        return ps === entrySeason || (ps == null && entrySeason === 1);
    }).slice(0, 2);
    const hits = [];
    for (const r of cands) {
        let html;
        try {
            html = (await g(r.url)).html;
        }
        catch (err) {
            continue;
        }
        KIT_SHOW_CACHE.set(r.url, html);
        const alt = KIT_ALT_TEXT(html);
        if (want.some(k => alt.includes(k)))
            hits.push(r);
    }
    if (hits.length > 1) {
        KIT_AMBIG = hits;
        return null;
    }
    return hits.length === 1 ? hits[0] : null;
}
async function KIT(raw, epParam) {
    try {
        const mm = String(raw).match(/^kitsu:(\d+)(?::(\d+))?/i);
        const ep = mm[2] ? Number(mm[2]) : (epParam == null ? null : Number(epParam));
        if (!ep)
            return [r("[v16] NOMATCH: kitsu:" + mm[1] + " tidak punya nomor episode")];
        const titles = await KIT_TITLES(mm[1]);
        KIT_SHOW_CACHE = new Map();
        const res = await KIT_SEARCH(titles);
        let pick = KIT_PICK(res, titles);
        if (!pick && !KIT_AMBIG)
            pick = await KIT_VERIFY(res, titles);
        if (!pick) {
            if (KIT_AMBIG)
                return [r("[v16] NOMATCH: kitsu:" + mm[1] + " ambigu, sama-sama cocok persis: " + KIT_AMBIG.map(x => x.title.slice(0, 40)).join(" | ") + ". Isi KIT_OVERRIDE")];
            return [r("[v16] NOMATCH: kitsu:" + mm[1] + KIT_DEBUG(res, titles))];
        }
        const eps = await S(pick.url);
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
