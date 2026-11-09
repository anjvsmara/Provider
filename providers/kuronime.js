const WORKER_URL = "https://kuroproxy.anjvsmara.workers.dev";

const BASE_URL = "https://kuronime.sbs";
const SOURCES_API = "https://animeku.org/api/v9/sources";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let lastEmbedHosts = [];

// Host yang sudah pasti tidak menghasilkan video di JS (DNS mati atau butuh WebView)
const SKIP_HOSTS = ['dsvplay.com', 'vidhidevip.com', 'callistanise.com', 'vidhidepro', 'vidhide'];
const HOST_TIMEOUT_MS = 8000;

function isSkippedHost(url) {
    const u = (url || '').toLowerCase();
    return SKIP_HOSTS.some(h => u.indexOf(h) >= 0);
}

// Batas waktu per host. Kalau setTimeout tidak tersedia, dijalankan tanpa batas.
function withTimeout(promise, ms) {
    if (typeof setTimeout !== 'function') return promise;
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve([]), ms))
    ]);
}

const MEDIA_REGEX_SRC = "https?:\\/\\/[^\"'\\s<]+?(?:\\.m3u8|\\.mp4)(?!\\w)|https?:\\/\\/[^\"'\\s<]+?(?:googlevideo|blogger|blogspot|bloggerusercontent|pixeldrain)[^\"'\\s<]*";

/* ============================ Utilitas umum ============================ */

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

// Ambil nilai atribut dari string tag, mis. getAttr('<a href="x">', 'href')
function getAttr(tag, name) {
    const re = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
    const m = tag.match(re);
    return m ? decodeEntities(m[1]) : null;
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

/* ============================ Encoding helpers ========================= */

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64ToBytes(str) {
    const out = [];
    let buf = 0, bits = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charAt(i);
        if (ch === '=') break;
        const idx = B64_CHARS.indexOf(ch);
        if (idx < 0) continue;
        buf = ((buf << 6) | idx) & 0xffffff;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buf >> bits) & 0xff);
        }
    }
    return out;
}

function hexToBytes(hex) {
    const out = [];
    for (let i = 0; i + 1 < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
    return out;
}

function utf8Decode(bytes) {
    let s = '';
    let i = 0;
    while (i < bytes.length) {
        const c = bytes[i++];
        let cp;
        if (c < 0x80) {
            cp = c;
        } else if (c >= 0xc0 && c < 0xe0) {
            cp = ((c & 0x1f) << 6) | (bytes[i++] & 0x3f);
        } else if (c >= 0xe0 && c < 0xf0) {
            cp = ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        } else {
            cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        }
        if (cp >= 0x10000) {
            cp -= 0x10000;
            s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        } else {
            s += String.fromCharCode(cp);
        }
    }
    return s;
}

function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let cp = str.charCodeAt(i);
        if (cp >= 0xd800 && cp < 0xdc00 && i + 1 < str.length) {
            const lo = str.charCodeAt(i + 1);
            if (lo >= 0xdc00 && lo < 0xe000) {
                cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
                i++;
            }
        }
        if (cp < 0x80) {
            out.push(cp);
        } else if (cp < 0x800) {
            out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
        } else if (cp < 0x10000) {
            out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else {
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        }
    }
    return out;
}

/* ================================== MD5 ================================ */

const MD5_K = [];
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

function md5(bytes) {
    const msg = bytes.slice();
    const bitLen = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const lo = bitLen >>> 0;
    const hi = Math.floor(bitLen / 4294967296) >>> 0;
    msg.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255,
             hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    for (let off = 0; off < msg.length; off += 64) {
        const M = [];
        for (let i = 0; i < 16; i++) {
            const p = off + 4 * i;
            M[i] = (msg[p] | (msg[p + 1] << 8) | (msg[p + 2] << 16) | (msg[p + 3] << 24)) >>> 0;
        }
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            F = (F + A + MD5_K[i] + M[g]) >>> 0;
            A = D;
            D = C;
            C = B;
            B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) >>> 0;
        }
        a0 = (a0 + A) >>> 0;
        b0 = (b0 + B) >>> 0;
        c0 = (c0 + C) >>> 0;
        d0 = (d0 + D) >>> 0;
    }

    const out = [];
    for (const v of [a0, b0, c0, d0]) {
        out.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
    }
    return out;
}

// OpenSSL EVP_BytesToKey dengan MD5 (sama seperti kode CryptoJS sebelumnya)
function evpBytesToKey(password, salt, keyLen) {
    let key = [];
    let prev = [];
    while (key.length < keyLen) {
        prev = md5(prev.concat(password, salt));
        key = key.concat(prev);
    }
    return key.slice(0, keyLen);
}

/* ================================== AES ================================ */

function gmul(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        const hi = a & 0x80;
        a = (a << 1) & 0xff;
        if (hi) a ^= 0x1b;
        b >>= 1;
    }
    return p;
}

const AES_SBOX = [];
const AES_INV = [];
(function buildAesTables() {
    for (let x = 0; x < 256; x++) {
        let inv = 0;
        if (x) {
            for (let y = 1; y < 256; y++) {
                if (gmul(x, y) === 1) { inv = y; break; }
            }
        }
        let s = inv;
        let r = inv;
        for (let k = 0; k < 4; k++) {
            r = ((r << 1) | (r >> 7)) & 0xff;
            s ^= r;
        }
        s ^= 0x63;
        AES_SBOX[x] = s;
        AES_INV[s] = x;
    }
})();

const AES_RCON = [0, 1, 2, 4, 8, 16, 32, 64];

function aesSubWord(t) {
    return ((AES_SBOX[(t >>> 24) & 0xff] << 24) |
            (AES_SBOX[(t >>> 16) & 0xff] << 16) |
            (AES_SBOX[(t >>> 8) & 0xff] << 8) |
            AES_SBOX[t & 0xff]) >>> 0;
}

// Key expansion AES-256 (Nk = 8, Nr = 14)
function aesExpandKey(key) {
    const w = [];
    for (let i = 0; i < 8; i++) {
        w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
    }
    for (let i = 8; i < 60; i++) {
        let t = w[i - 1];
        if (i % 8 === 0) {
            t = ((t << 8) | (t >>> 24)) >>> 0;
            t = aesSubWord(t) ^ (AES_RCON[i / 8] << 24);
        } else if (i % 8 === 4) {
            t = aesSubWord(t);
        }
        w[i] = (w[i - 8] ^ t) >>> 0;
    }
    return w;
}

function aesAddRoundKey(s, w, round) {
    for (let c = 0; c < 4; c++) {
        const word = w[4 * round + c];
        for (let r = 0; r < 4; r++) {
            s[r + 4 * c] ^= (word >>> (24 - 8 * r)) & 0xff;
        }
    }
}

function aesInvShiftRows(s) {
    for (let r = 1; r < 4; r++) {
        const row = [s[r], s[r + 4], s[r + 8], s[r + 12]];
        for (let c = 0; c < 4; c++) {
            s[r + 4 * c] = row[(c - r + 4) % 4];
        }
    }
}

function aesInvSubBytes(s) {
    for (let i = 0; i < 16; i++) s[i] = AES_INV[s[i]];
}

function aesInvMixColumns(s) {
    for (let c = 0; c < 4; c++) {
        const a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
        s[4 * c]     = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9);
        s[4 * c + 1] = gmul(a0, 9)  ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13);
        s[4 * c + 2] = gmul(a0, 13) ^ gmul(a1, 9)  ^ gmul(a2, 14) ^ gmul(a3, 11);
        s[4 * c + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9)  ^ gmul(a3, 14);
    }
}

function aesDecryptBlock(input, w) {
    const s = input.slice();
    aesAddRoundKey(s, w, 14);
    for (let round = 13; round >= 1; round--) {
        aesInvShiftRows(s);
        aesInvSubBytes(s);
        aesAddRoundKey(s, w, round);
        aesInvMixColumns(s);
    }
    aesInvShiftRows(s);
    aesInvSubBytes(s);
    aesAddRoundKey(s, w, 0);
    return s;
}

// AES-256-CBC decrypt dengan padding PKCS7
function aes256CbcDecrypt(key, iv, data) {
    const w = aesExpandKey(key);
    const out = [];
    let prev = iv;
    for (let off = 0; off < data.length; off += 16) {
        const block = data.slice(off, off + 16);
        const dec = aesDecryptBlock(block, w);
        for (let i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
        prev = block;
    }
    const pad = out[out.length - 1];
    if (!(pad >= 1 && pad <= 16)) throw new Error('bad PKCS7 padding');
    return out.slice(0, out.length - pad);
}

/* ============================ Mirror payload ============================ */

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

/* ================================ Unpacker ============================== */

function unescapeJs(s) {
    return s.replace(/\\(['"\\])/g, '$1');
}

// Unpacker P.A.C.K.E.R. tanpa eval / new Function
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

/* ============================= URL / stream ============================= */

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

// Nama sumber yang tampil di Nuvio, sesuai host asalnya
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

// Mengubah URL menjadi stream bila sudah langsung bisa diputar.
// Mengembalikan null bila URL masih berupa halaman player yang perlu di-inspect.
function streamFromUrl(url, referer, quality) {
    const q = quality || getQualityFromUrl(url);
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

function dedupeStreams(streams) {
    const seen = new Set();
    return streams.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

// Mengumpulkan kandidat URL dari HTML (iframe/video/source + regex media)
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

// Resolver khusus mp4upload: halamannya memakai script terkemas (packed),
// dan URL video ada di player.src("...") setelah di-unpack.
async function resolveMp4Upload(playerUrl, referer) {
    try {
        const html = await fetchText(playerUrl, { headers: { "Referer": referer } });
        const unpacked = unpack(html);
        const m = unpacked.match(/player\.src\(\s*["']([^"']+)["']/) ||
                  unpacked.match(/src\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/) ||
                  html.match(/player\.src\(\s*["']([^"']+)["']/);
        if (!m) return null;
        const videoUrl = m[1];
        if (videoUrl.indexOf('http') !== 0) return null;
        return {
            name: "Mp4Upload",
            title: "Kuronime - Mp4Upload",
            url: videoUrl,
            quality: getQualityFromUrl(videoUrl),
            headers: { "Referer": "https://www.mp4upload.com/", "User-Agent": USER_AGENT }
        };
    } catch (err) {
        return null;
    }
}

async function inspectPlayerPage(playerUrl, referer) {
    const direct = streamFromUrl(playerUrl, referer);
    if (direct) return [direct];

    if (playerUrl.indexOf('mp4upload.com') >= 0) {
        const mp4 = await resolveMp4Upload(playerUrl, referer);
        if (mp4) return [mp4];
    }

    try {
        const html = await fetchText(playerUrl, { headers: { "Referer": referer } });
        const clean = unpack(html).replace(/\\\//g, '/');
        const streams = [];
        for (const url of collectUrlsFromHtml(clean)) {
            const s = streamFromUrl(url, playerUrl);
            if (s) streams.push(s);
        }
        return streams;
    } catch (err) {
        return [];
    }
}

/* ============================ TMDB & pencarian ========================== */

// Menerima TMDB ID numerik atau IMDb ID (tt...) dan mengembalikan TMDB ID + tipe
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
        originalTitle: data.original_name || data.original_title || ""
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

// Ambil judul + URL anime dari sebuah blok HTML hasil pencarian
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

async function searchKuronime(query) {
    const html = await fetchText(`${BASE_URL}/?s=${encodeURIComponent(query)}`, {
        headers: { "Referer": BASE_URL }
    });

    const results = [];

    // article.bs (termasuk di dalam div.listupd)
    const articleRe = /<article\b[^>]*class="[^"]*\bbs\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let m;
    while ((m = articleRe.exec(html)) !== null) {
        const item = pickAnime(m[1]);
        if (item) results.push(item);
    }

    // a.series di dalam .imgseries
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

// Normalisasi: buang spasi dan tanda baca ASCII/CJK, huruf non-Latin tetap dipertahankan
const normalizeTitle = (s) =>
    (s || '').toLowerCase().replace(/[\s!-\/:-@\[-`{-~\u3000-\u303f\uff01-\uff0f]+/g, '');

// Token kata (huruf/angka Latin) untuk pencocokan berbasis kata.
function latinTokens(s) {
    return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 0);
}

// Nomor season dari judul Kuronime, mis. "Black Clover Season 2" -> 2. null bila tidak ada suffix.
function seasonOf(title) {
    const t = (title || '').toLowerCase();
    let m = t.match(/season\s*(\d+)/);
    if (m) return parseInt(m[1], 10);
    m = t.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/);
    if (m) return parseInt(m[1], 10);
    return null;
}

// Pencocokan kecocokan dengan urutan: exact -> substring -> kesamaan kata.
// Hanya entri dengan season yang diminta yang dipertimbangkan.
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
        // Untuk serial TV, buang entri film (mis. "Black Clover Movie: ...")
        .filter(i => !(mediaType === 'tv' && /\bmovie\b/i.test(i.title)));

    // Entri dengan nomor season yang diminta. Kalau tidak ada (mis. season yang
    // di Kuronime berupa judul bagian tanpa "Season N"), pakai entri tanpa suffix season.
    let items = anySeason ? all : all.filter(i => i.season === want);
    if (!anySeason && items.length === 0 && want > 1) {
        items = all.filter(i => i.rawSeason === null);
    }

    const targets = titles.map(normalizeTitle).filter(Boolean);
    if (items.length === 0 || targets.length === 0) return null;

    // 1. Exact match
    for (const t of targets) {
        const hit = items.find(i => i.key === t);
        if (hit) return hit;
    }

    // 2. Substring match, hanya bila kedua string cukup panjang.
    //    Bila ada beberapa kecocokan, pilih judul yang paling pendek (paling mirip).
    for (const t of targets) {
        if (t.length < 4) continue;
        const hits = items.filter(i => i.key.length >= 4 && (i.key.indexOf(t) >= 0 || t.indexOf(i.key) >= 0));
        if (hits.length) {
            return hits.reduce((a, b) => (b.key.length < a.key.length ? b : a));
        }
    }

    // 3. Kesamaan kata: minimal 2 kata target, dan >= 60% kata target ada di judul Kuronime
    let best = null;
    for (const title of titles) {
        const tTok = [...new Set(latinTokens(title))];
        if (tTok.length < 2) continue;
        for (const item of items) {
            const itemSet = new Set(item.tok);
            const shared = tTok.filter(w => itemSet.has(w)).length;
            const ratio = shared / tTok.length;
            if (shared < 2 || ratio < 0.6) continue;
            // prioritas: rasio tertinggi, lalu judul Kuronime yang paling pendek (paling mirip)
            if (!best || ratio > best.ratio || (ratio === best.ratio && item.tok.length < best.item.tok.length)) {
                best = { item, ratio };
            }
        }
    }
    return best ? best.item : null;
}

async function getEpisodes(animeUrl) {
    const html = await fetchText(animeUrl, { headers: { "Referer": BASE_URL } });

    // Batasi pencarian ke bagian daftar episode (class bixbox bxcl)
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

/* ============================ Ekstraksi stream ========================== */

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
    const usableItems = embedItems.filter(i => !isSkippedHost(i.url));

    if (usableItems.length === 0) {
        return dedupeStreams(await inspectPageFallback(html, episodeUrl, new Set()));
    }

    const results = await Promise.all(usableItems.map(item => {
        const direct = streamFromUrl(item.url, episodeUrl, item.quality);
        return direct
            ? Promise.resolve([direct])
            : withTimeout(inspectPlayerPage(item.url, episodeUrl), HOST_TIMEOUT_MS);
    }));
    let streams = flatten(results);

    if (streams.length === 0) {
        const visited = new Set(usableItems.map(i => i.url));
        streams = await inspectPageFallback(html, episodeUrl, visited);
    }

    return dedupeStreams(streams);
}

/* ============================ AniList (romaji) ========================== */

const ANILIST_QUERY = "query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english } synonyms } }";

// Mengambil judul romaji/Inggris/sinonim dari AniList untuk satu judul.
// Hanya judul Latin yang dikembalikan (tanpa kanji/kana).
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

/* ================================ Entry point =========================== */

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

        // Tahap 1: cari dengan judul TMDB (Inggris) dan judul asli
        let results = await searchKuronime(info.title);
        if (results.length === 0 && info.originalTitle) {
            results = await searchKuronime(info.originalTitle);
        }
        let match = findBestMatch(results, [info.title, info.originalTitle], seasonNum, mediaType);

        // Tahap 2: ambil romaji dari AniList, lalu cari lagi di Kuronime
        let aliases = [];
        if (!match) {
            aliases = await getAniListTitles(info.title);

            // Cocokkan romaji ke hasil pencarian yang sudah ada dulu (tanpa request baru)
            match = findBestMatch(results, aliases, seasonNum, mediaType);

            // Kalau belum, cari ulang di Kuronime pakai tiap romaji
            for (const alias of aliases) {
                if (match) break;
                const aliasResults = await searchKuronime(alias);
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

        if (mediaType === 'movie') {
            const episodeUrl = episodes.length > 0 ? episodes[0].url : match.url;
            const movieStreams = await extractStreamsFromEpisode(episodeUrl);
            return movieStreams.length ? movieStreams : [debugStream("NOSTREAM hosts=" + lastEmbedHosts.join(",") + " url=" + episodeUrl)];
        }

        // Series: pemetaan episode per-season belum terbukti untuk season > 1
        const numbered = episodes.filter(e => e.episodeNum !== null);
        let target = numbered.find(e => e.episodeNum === episode);

        // Fallback berdasarkan urutan hanya bila tidak ada episode yang bernomor
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
