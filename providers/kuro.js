const t = "https://kuroproxy.anjvsmara.workers.dev", e = "https://kuronime.sbs", n = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
let r = [];
const i = ["dsvplay.com", "vidhidevip.com", "callistanise.com", "vidhidepro", "vidhide", "krakenfiles.com"], a = ["pixeldrain.com", "mp4upload.com"];
function s(t) { const e = (t || "").toLowerCase(); return i.some(t => e.indexOf(t) >= 0); }
function o(t) { return t.reduce((t, e) => t.concat(e), []); }
function l(t) {
    return t.replace(/&#(\d+);/g, (t, e) => {
        try {
            return String.fromCodePoint(Number(e));
        }
        catch (t) {
            return "";
        }
    }).replace(/&#x([0-9a-f]+);/gi, (t, e) => {
        try {
            return String.fromCodePoint(parseInt(e, 16));
        }
        catch (t) {
            return "";
        }
    }).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
function c(t) { return l(t.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }
function f(t, e) { const n = new RegExp("(?:^|\\s)" + e + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"), r = t.match(n); return r ? l(r[1]) : null; }
function d(t) { const e = String(t || "").match(/(\d{3,4})\s*p/i); return e ? e[1] + "p" : "Auto"; }
function p(t) { const e = t.match(/\b(2160|1440|1080|720|480|360|240)\b/); return e ? e[1] + "p" : "Auto"; }
async function m(t, e) {
    const r = e || {}, i = await fetch(t, { ...r, headers: { "User-Agent": n, ...r.headers || {} } });
    if (i.status >= 400)
        throw new Error(`HTTP ${i.status} for ${t}`);
    return i.text();
}
async function h(e) {
    try {
        return await async function (e) { const r = await fetch(t + "/decrypt", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": n }, body: JSON.stringify({ encoded: e }) }); return r.status >= 400 ? null : JSON.parse(await r.text()); }(e);
    }
    catch (t) {
        return null;
    }
}
function b(t) { return t.replace(/\\(['"\\])/g, "$1"); }
function y(t) {
    const e = t.match(/\}\s*\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])((?:\\.|(?!\5)[^\\])*)\5\.split\('\|'\)/);
    if (!e)
        return t;
    try {
        const t = b(e[2]), n = parseInt(e[3], 10);
        let r = parseInt(e[4], 10);
        const i = b(e[6]).split("|"), a = t => (t < n ? "" : a(Math.floor(t / n))) + (t % n > 35 ? String.fromCharCode(t % n + 29) : (t % n).toString(36));
        let s = t;
        for (; r--;)
            if (i[r]) {
                const t = a(r), e = i[r];
                s = s.replace(new RegExp("\\b" + t + "\\b", "g"), () => e);
            }
        return s;
    }
    catch (e) {
        return t;
    }
}
function w(t) {
    const e = t.split("?")[0].toLowerCase();
    if (e.endsWith(".html") || e.endsWith(".htm"))
        return !1;
    const n = e.split("/");
    return !(n.length < 4 || "" === n[3]) && (e.endsWith(".m3u8") || e.endsWith(".mp4") || e.indexOf("mime=video/mp4") >= 0 || e.indexOf("mime=video%2fmp4") >= 0 || e.indexOf("googlevideo") >= 0 || e.indexOf("bloggerusercontent") >= 0 || e.indexOf("pixeldrain.com/api/file/") >= 0);
}
function S(t, e, r) {
    const i = d(r || p(t));
    if (t.indexOf("pixeldrain.com") >= 0)
        return function (t, e) { const r = t.match(/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/); return r ? { name: "Pixeldrain", title: `Kuronime - Pixeldrain (${e})`, url: `https://pixeldrain.com/api/file/${r[1]}`, quality: e, headers: { "User-Agent": n } } : null; }(t, i);
    if (w(t)) {
        const r = function (t) { const e = (t || "").toLowerCase(); return e.indexOf("pixeldrain.com") >= 0 ? "Pixeldrain" : e.indexOf("mp4upload.com") >= 0 ? "Mp4Upload" : e.indexOf("googlevideo") >= 0 ? "Google" : e.indexOf("blogger") >= 0 || e.indexOf("blogspot") >= 0 ? "Blogger" : "Kuronime"; }(t);
        return { name: r, title: `Kuronime - ${r} (${i})`, url: t, quality: i, headers: { Referer: e, "User-Agent": n } };
    }
    return null;
}
function O(t) { return { name: t.slice(0, 400), title: "DEBUG", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4", quality: "360p" }; }
const x = ["240p", "360p", "480p"], v = ["720p", "1080p"];
function k(t) { const e = new Set, n = t.filter(t => !e.has(t.url) && (e.add(t.url), !0)); return n.some(t => v.indexOf(t.quality) >= 0) ? n.filter(t => x.indexOf(t.quality) < 0) : n; }
async function N(t, e, r) {
    const i = S(t, e, r);
    if (i)
        return [i];
    if (t.indexOf("mp4upload.com") >= 0) {
        const i = await async function (t, e, r) {
            try {
                const i = await m(t, { headers: { Referer: e } }), a = y(i), s = a.match(/player\.src\(\s*["']([^"']+)["']\)/) || a.match(/src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/) || i.match(/player\.src\(\s*["']([^"']+)["']\)/);
                if (!s)
                    return null;
                const o = s[1];
                if (0 !== o.indexOf("http"))
                    return null;
                const l = d(r || p(o));
                return { name: "Mp4Upload", title: "Kuronime - Mp4Upload (" + l + ")", url: o, quality: l, headers: { Referer: "https://www.mp4upload.com/", "User-Agent": n } };
            }
            catch (t) {
                return null;
            }
        }(t, e, r);
        if (i)
            return [i];
        return [];
    }
    try {
        const n = y(await m(t, { headers: { Referer: e } })).replace(/\\\//g, "/"), i = [];
        for (const e of function (t) {
            const e = [], n = /<(iframe|video|source)\b[^>]*>/gi;
            let r;
            for (; null !== (r = n.exec(t));) {
                const t = f(r[0], "src") || f(r[0], "data-src");
                t && 0 === t.indexOf("http") && e.push(t.trim());
            }
            const i = new RegExp("https?:\\/\\/[^\"'\\s<]+?(?:\\.m3u8|\\.mp4)(?!\\w)|https?:\\/\\/[^\"'\\s<]+?(?:googlevideo|blogger|blogspot|bloggerusercontent|pixeldrain)[^\"'\\s<]*", "gi");
            for (; null !== (r = i.exec(t));)
                e.push(r[0]);
            return e;
        }(n)) {
            const n = S(e, t, r);
            n && i.push(n);
        }
        return i;
    }
    catch (t) {
        return [];
    }
}
function A(t) {
    const e = [], n = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let r;
    for (; null !== (r = n.exec(t));)
        e.push({ tag: "<a" + r[1] + ">", inner: r[2] });
    return e;
}
function I(t) {
    for (const e of A(t)) {
        const t = f(e.tag, "href");
        if (!t || t.indexOf("/anime/") < 0)
            continue;
        const n = (e.inner.match(/<img\b[^>]*>/i) || [""])[0], r = (e.inner.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || ["", ""])[1], i = f(e.tag, "title") || c(r) || f(n, "alt") || c(e.inner);
        if (i)
            return { title: i.trim(), url: t.trim() };
    }
    return null;
}
async function T(t) {
    const e = function (t) { return String(t || "").replace(/\(\s*\d{4}\s*\)/g, " ").replace(/[:.~!?'"’‘“”`]/g, " ").replace(/\s+/g, " ").trim(); }(t);
    if (!e)
        return [];
    let n = await P(e);
    if (0 === n.length) {
        const t = e.split(" ").filter(t => t.length > 0);
        t.length > 3 && (n = await P(t.slice(0, 3).join(" ")));
    }
    return n;
}
let SC = new Map;
async function P(t) {
    if (SC.has(t))
        return SC.get(t);
    const p = PR(t);
    SC.set(t, p);
    try {
        return await p;
    }
    catch (e) {
        throw SC.delete(t), e;
    }
}
async function PR(t) {
    const n = (await m(`${e}/?s=${encodeURIComponent(t)}`, { headers: { Referer: e } })).split(/<div[^>]*\bid=["']sidebar["']/i)[0], r = [], i = /<article\b[^>]*class="[^"]*\bbs\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let a;
    for (; null !== (a = i.exec(n));) {
        const t = I(a[1]);
        t && r.push(t);
    }
    for (const t of A(n)) {
        if (!/\bseries\b/.test(f(t.tag, "class") || ""))
            continue;
        const e = f(t.tag, "href");
        if (!e || e.indexOf("/anime/") < 0)
            continue;
        const n = f(t.tag, "title") || c(t.inner);
        n && r.push({ title: n.trim(), url: e.trim() });
    }
    const s = new Set;
    return r.filter(t => !s.has(t.url) && (s.add(t.url), !0));
}
async function _(t) {
    const n = KIT_SHOW_CACHE.get(t) || await m(t, { headers: { Referer: e } }), r = n.search(/class="[^"]*bixbox[^"]*bxcl/), i = r >= 0 ? n.slice(r) : n, a = [], s = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let o;
    for (; null !== (o = s.exec(i));) {
        const t = A(o[1]).find(t => (f(t.tag, "href") || "").indexOf("/nonton-") >= 0);
        if (!t)
            continue;
        const e = f(t.tag, "href"), n = c(t.inner), r = n.match(/Episode\s+(\d+(?:\.\d+)?)/i);
        a.push({ title: n, episodeNum: r ? parseFloat(r[1]) : null, url: e.trim() });
    }
    return a;
}
async function R(t, e, n) {
    const r = [], i = /<iframe\b[^>]*>/gi;
    let a;
    for (; null !== (a = i.exec(t));) {
        const t = (f(a[0], "src") || f(a[0], "data-src") || "").trim();
        0 !== t.indexOf("http") || n.has(t) || s(t) || r.push(t);
    }
    return o(await Promise.all(r.map(t => N(t, e))));
}
function U(t) { return (String(t || "").match(/^https?:\/\/([^\/]+)/) || [])[1] || "?"; }
async function $(t) {
    const n = await m(t, { headers: { Referer: e } }), i = n.match(/var\s+_0xa100d42aa\s*=\s*["']([^"']+)["']/);
    if (!i)
        return "halaman episode tidak punya sumber video", k(await R(n, t, new Set));
    let l;
    try {
        const n = await m("https://animeku.org/api/v9/sources", { method: "POST", headers: { "Content-Type": "application/json", Origin: e, Referer: t, Accept: "application/json, text/plain, */*" }, body: JSON.stringify({ id: i[1] }) });
        l = JSON.parse(n);
    }
    catch (e) {
        return "API sumber gagal: " + e.message, k(await R(n, t, new Set));
    }
    const u = l.mirror ? await h(l.mirror) : null;
    u || ("mirror tidak bisa di-decode");
    const c = function (t) {
        const e = [];
        if (!t)
            return e;
        if (t.embed)
            for (const n in t.embed) {
                const r = t.embed[n];
                for (const t in r) {
                    const i = r[t];
                    i && 0 === i.indexOf("http") && e.push({ url: i, quality: n });
                }
            }
        for (const n of ["filelions", "blog", "raw"]) {
            const r = t[n];
            r && 0 === r.indexOf("http") && e.push({ url: r, quality: "Auto" });
        }
        return e;
    }(u);
    r = c.map(t => U(t.url));
    const f = c.filter(t => !s(t.url) && function (t) { const e = (t || "").toLowerCase(); return a.some(t => e.indexOf(t) >= 0) || w(t); }(t.url));
    if (0 === f.length)
        return c.length > 0 ? "semua host diskip/tidak didukung: " + r.join(",") : u && ("mirror kosong"), k(await R(n, t, new Set));
    let d = o(await Promise.all(f.map(e => { const n = S(e.url, t, e.quality); return n ? Promise.resolve([n]) : (r = N(e.url, t, e.quality), i = 8e3, "function" != typeof setTimeout ? r : function (p, ms) { let id; return Promise.race([p, new Promise(z => { id = setTimeout(() => z([]), ms); })]).then(v => { clearTimeout(id); return v; }, x => { clearTimeout(id); throw x; }); }(r, i)); var r, i; })));
    if (0 === d.length) {
        "host terdaftar tapi gagal di-resolve (kemungkinan mati/diubah): " + f.map(t => U(t.url)).join(",");
        const e = new Set(f.map(t => t.url));
        d = await R(n, t, e);
    }
    return k(d);
}
const q = { 30984: { 17: 50 } }, K = t + "/mapping";
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
    const at = JSON.parse(await m("https://kitsu.io/api/edge/anime/" + kitId)).data.attributes || {};
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
    const parts = await Promise.all(queries.slice(0, 4).map(q => T(q)));
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
            html = await m(r.url, { headers: { Referer: e } });
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
            return [O("[v28] NOMATCH: kitsu:" + mm[1] + " tidak punya nomor episode")];
        const titles = await KIT_TITLES(mm[1]);
        KIT_SHOW_CACHE = new Map();
        const res = await KIT_SEARCH(titles);
        let pick = KIT_PICK(res, titles);
        if (!pick && !KIT_AMBIG)
            pick = await KIT_VERIFY(res, titles);
        if (!pick) {
            if (KIT_AMBIG)
                return [O("[v28] NOMATCH: kitsu:" + mm[1] + " ambigu, sama-sama cocok persis: " + KIT_AMBIG.map(x => x.title.slice(0, 40)).join(" | ") + ". Isi KIT_OVERRIDE")];
            return [O("[v28] NOMATCH: kitsu:" + mm[1] + KIT_DEBUG(res, titles))];
        }
        const eps = await _(pick.url);
        const hit = eps.find(x => x.episodeNum === ep);
        if (!hit)
            return [O("[v28] NOEP: episode " + ep + " tidak ada di " + pick.title + " (" + eps.length + " episode)")];
        const st = await $(hit.url);
        return st.length ? st : [O("[v28] NOSTREAM: " + hit.url)];
    }
    catch (e) {
        return [O("[v28] NOMATCH: kitsu gagal diambil (" + e.message + ")")];
    }
}
async function X(id, type, season, episode) {
    if (String(type) === "movie") {
        return [O("[v28] NOMATCH: film belum didukung. Skrip ini hanya untuk serial kitsu")];
    }
    if (!/^kitsu:/i.test(String(id))) {
        return [O("[v28] NOMATCH: ID " + id + " bukan kitsu. Hanya ID kitsu yang didukung")];
    }
    return await KIT(id, episode);
}

"undefined" != typeof module && module.exports
    ? (module.exports = { getStreams: X })
    : (global.getStreams = X);
