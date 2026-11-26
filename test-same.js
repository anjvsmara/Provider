#!/usr/bin/env node
"use strict";

// Samehadaku provider test runner.
// Run from the repository root with Node.js 18+ (built-in fetch required).
// Usage:
//   node test-same.js kitsu:50007:3 1
//   node test-same.js kitsu:51018:1 1
//   node test-same.js --regression

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PROVIDER_PATH = path.join(__dirname, "providers", "same.js");

if (typeof fetch !== "function") {
    console.error("ERROR: Node.js 18+ with built-in fetch is required.");
    process.exit(1);
}

if (!fs.existsSync(PROVIDER_PATH)) {
    console.error("ERROR: providers/same.js not found. Run this script from the repo checkout.");
    process.exit(1);
}

const source = fs.readFileSync(PROVIDER_PATH, "utf8");

const trackedFetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = String(options.method || (input && input.method) || "GET").toUpperCase();
    const started = Date.now();

    console.log("\n[REQ] " + method + " " + url);
    try {
        const response = await fetch(input, options);
        console.log(
            "[HTTP] " + response.status + " | " +
            (Date.now() - started) + "ms | " + url
        );
        return response;
    } catch (error) {
        console.log(
            "[NET ERROR] " + (Date.now() - started) + "ms | " +
            url + " | " + (error && error.message ? error.message : String(error))
        );
        throw error;
    }
};

const sandbox = {
    module: { exports: {} },
    exports: {},
    fetch: trackedFetch,
    console,
    URL,
    URLSearchParams,
    Headers,
    Request,
    Response,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    Buffer,
    process
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

try {
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, {
        filename: PROVIDER_PATH,
        timeout: 15000
    });
} catch (error) {
    console.error("\n[LOAD ERROR]", error && error.stack ? error.stack : error);
    process.exit(1);
}

const getStreams = sandbox.module.exports && sandbox.module.exports.getStreams;
if (typeof getStreams !== "function") {
    console.error("ERROR: providers/same.js does not export getStreams().");
    process.exit(1);
}

const regressionCases = [
    { id: "kitsu:50007:3", season: 1, label: "Vigilantes S2 / episode 3" },
    { id: "kitsu:51018:1", season: 1, label: "Tougen Anki season-specific title / episode 1" }
];

function parseCase(args) {
    return {
        id: args[0],
        season: Number(args[1] || 1),
        label: args[0]
    };
}

async function runCase(testCase) {
    console.log("\n==================================================");
    console.log("TEST :", testCase.label);
    console.log("INPUT:", testCase.id, "| season =", testCase.season);
    console.log("==================================================");

    const started = Date.now();
    try {
        const results = await getStreams(testCase.id, "tv", testCase.season, undefined);
        console.log("\n[RESULT] " + (Array.isArray(results) ? results.length : 0) + " stream(s)");
        if (Array.isArray(results)) {
            results.forEach((item, index) => {
                console.log(
                    "[" + (index + 1) + "] " +
                    (item && item.title ? item.title : "Untitled") +
                    " | " + (item && item.quality ? item.quality : "Auto") +
                    " | " + (item && item.name ? item.name : "") +
                    " | " + (item && item.url ? item.url : "")
                );
            });
        } else {
            console.log("[RESULT RAW]", results);
        }
    } catch (error) {
        console.error("[TEST ERROR]", error && error.stack ? error.stack : error);
    }
    console.log("[DONE] " + (Date.now() - started) + "ms");
}

(async () => {
    const args = process.argv.slice(2);
    const cases = args[0] === "--regression"
        ? regressionCases
        : args.length
            ? [parseCase(args)]
            : [];

    if (!cases.length) {
        console.log("Usage:");
        console.log("  node test-same.js kitsu:50007:3 1");
        console.log("  node test-same.js kitsu:51018:1 1");
        console.log("  node test-same.js --regression");
        process.exitCode = 1;
        return;
    }

    for (const testCase of cases) {
        await runCase(testCase);
    }
})().catch(error => {
    console.error("[FATAL]", error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
