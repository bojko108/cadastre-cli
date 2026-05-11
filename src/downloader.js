import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { pipeline } from 'node:stream/promises';

const MAX_REDIRECTS = 5;

/**
 * Maps a URL to a local file path, mirroring the `path` query param as
 * directory segments so related files stay grouped on disk.
 *
 * e.g. "...?path=област София/община Столична/гр. Нови Искър (00357)/собственост сгради.zip"
 *   →  <outDir>/област_София/община_Столична/гр._Нови_Искър_(00357)/собственост_сгради.zip
 */
export function urlToDestPath(baseDir, rawUrl) {
    const url = new URL(rawUrl);
    const logical = url.searchParams.get('path') || url.pathname;

    const parts = logical
        .split('/')
        .map(s => s.trim().replace(/\s+/g, '_'))
        .filter(Boolean);

    return path.join(baseDir, ...parts);
}

/**
 * Downloads a single URL to destPath.
 * Follows redirects, streams directly to disk (no full-file buffering),
 * and writes to a .tmp file that is atomically renamed on success.
 *
 * @returns {Promise<number>} bytes written
 */
export async function downloadFile(rawUrl, destPath, { timeoutMs = 120_000, redirectsLeft = MAX_REDIRECTS } = {}) {
    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    return new Promise((resolve, reject) => {
        const proto = rawUrl.startsWith('https') ? https : http;

        const req = proto.get(
            rawUrl,
            {
                headers: { 'User-Agent': 'cadastre-cli/1.0' },
                timeout: timeoutMs,
            },
            (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    res.resume();
                    if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
                    const loc = res.headers.location;
                    if (!loc) return reject(new Error('Redirect with no Location header'));
                    resolve(downloadFile(loc, destPath, { timeoutMs, redirectsLeft: redirectsLeft - 1 }));
                    return;
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const tmp = destPath + '.tmp';
                const fileStream = fs.createWriteStream(tmp);

                pipeline(res, fileStream)
                    .then(async () => {
                        await fsp.rename(tmp, destPath);
                        const { size } = await fsp.stat(destPath);
                        resolve(size);
                    })
                    .catch(async (err) => {
                        await fsp.rm(tmp, { force: true });
                        reject(err);
                    });
            },
        );

        req.on('timeout', () => req.destroy(new Error('Request timed out')));
        req.on('error', reject);
    });
}

