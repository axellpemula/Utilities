#!/usr/bin/env node
/**
 * `npm run build` - packages both packs into a single `.mcaddon`.
 *
 * Written with node:zlib only, so the build has no dependencies and produces
 * the same archive on macOS, Linux and Windows.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKS = ["Utils Vein Miner BP", "Utils Vein Miner RP"];
const OUTPUT_DIR = join(ROOT, "dist");

/* ------------------------------------------------------------------ crc32 -- */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
        let value = index;
        for (let bit = 0; bit < 8; bit++)
            value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        table[index] = value >>> 0;
    }
    return table;
})();

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

/* -------------------------------------------------------------------- zip -- */

function collectFiles(root, dir = root) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === ".DS_Store") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...collectFiles(root, full));
        else files.push(full);
    }
    return files;
}

/**
 * @param {{name: string, data: Buffer}[]} entries
 * @returns {Buffer}
 */
function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    // Fixed timestamp (1980-01-01) keeps the archive reproducible.
    const dosTime = 0;
    const dosDate = 0x0021;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const compressed = deflateRawSync(entry.data);
        const crc = crc32(entry.data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);          // version needed
        local.writeUInt16LE(0x0800, 6);      // UTF-8 names
        local.writeUInt16LE(8, 8);           // deflate
        local.writeUInt16LE(dosTime, 10);
        local.writeUInt16LE(dosDate, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, compressed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);        // version made by
        central.writeUInt16LE(20, 6);        // version needed
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(dosTime, 12);
        central.writeUInt16LE(dosDate, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(0, 30);        // extra + comment length
        central.writeUInt16LE(0, 34);        // disk
        central.writeUInt16LE(0, 36);        // internal attributes
        central.writeUInt32LE(0, 38);        // external attributes
        central.writeUInt32LE(offset, 42);   // local header offset
        centralParts.push(central, name);

        offset += local.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

/* ------------------------------------------------------------------ build -- */

const manifest = JSON.parse(readFileSync(join(ROOT, PACKS[0], "manifest.json"), "utf8"));
const version = (manifest.header.version ?? [0, 0, 0]).join(".");

const entries = [];
for (const pack of PACKS) {
    const packRoot = join(ROOT, pack);
    if (!statSync(packRoot).isDirectory()) throw new Error(`missing pack folder: ${pack}`);
    for (const file of collectFiles(packRoot)) {
        entries.push({
            name: `${pack}/${relative(packRoot, file).split("\\").join("/")}`,
            data: readFileSync(file)
        });
    }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const output = join(OUTPUT_DIR, `Utils Vein Miner v${version}.mcaddon`);
writeFileSync(output, createZip(entries));

console.log(`✓ ${relative(ROOT, output)} (${entries.length} files, ${(statSync(output).size / 1024).toFixed(1)} KiB)`);
