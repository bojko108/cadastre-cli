import fsp from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import extractZip from 'extract-zip';
import { createLogger } from '../logger.js';
import { runPool } from '../pool.js';

/**
 * Recursively collects absolute paths to `.zip` files under `rootDir`.
 * @param {string} rootDir
 * @param {string[]} [acc]
 * @returns {Promise<string[]>}
 */
async function collectZipFiles(rootDir, acc = []) {
    const entries = await fsp.readdir(rootDir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(rootDir, ent.name);
        if (ent.isDirectory()) {
            await collectZipFiles(full, acc);
        } else if (ent.isFile() && path.extname(ent.name).toLowerCase() === '.zip') {
            acc.push(full);
        }
    }
    return acc;
}

export async function unzipCommand(opts) {
    const concurrency = parseInt(opts.concurrency || process.env.UNZIP_CONCURRENCY, 10);
    const log = createLogger(opts.logDir, 'unzip');
    let failed = 0;

    // Graceful SIGINT — flush the log before exiting
    process.on('SIGINT', async () => {
        log.warn('Interrupted — shutting down');
        await log.close();
        process.exit(130); // 128 + SIGINT(2), POSIX convention
    });

    const inDir = path.resolve(opts.in);
    const outDir = path.resolve(opts.out);

    log.info(`Log: ${log.logPath}`);
    log.info(`Unzipping from: ${inDir}`);
    log.info(`Extracting to: ${outDir}`);

    try {
        await fsp.access(inDir);
    } catch {
        log.error(`Input directory not found or not readable: ${inDir}`);
        log.error('Usage: cadastre unzip --in <dir> [--out <dir>]');
        await log.close();
        process.exit(1);
    }

    const zips = await collectZipFiles(inDir);

    if (zips.length === 0) {
        log.warn('No .zip files found — nothing to do.');
        await log.close();
        return;
    }

    log.info(`Found ${chalk.bold(zips.length)} ZIP archives  |  concurrency: ${concurrency}`);
    log.info('─'.repeat(60));

    const startAll = Date.now();
    let done = 0;

    await runPool(zips, concurrency, async (zipPath) => {
        const rel = path.relative(inDir, zipPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            log.warn(`Skipping (outside base): ${zipPath}`);
            return;
        }

        const ext = path.extname(rel);
        const folderName = path.basename(rel, ext);
        const destDir = path.resolve(path.join(outDir, path.dirname(rel), folderName));
        const label = rel.replace(/\\/g, '/');

        log.info(`→ ${label}`);
        const t0 = Date.now();

        try {
            await extractZip(zipPath, { dir: destDir });
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            done++;
            log.ok(`✓ ${label} — ${secs}s`);
        } catch (err) {
            failed++;
            log.error(`✗ ${label} — ${err.message}`);
        }
    });

    const totalSecs = ((Date.now() - startAll) / 1000).toFixed(1);
    log.info('─'.repeat(60));
    log.info(
        `Done in ${totalSecs}s — ` +
        `${chalk.green(`${done} extracted`)}` +
        (failed ? `, ${chalk.red(`${failed} failed`)}` : '') +
        ` of ${zips.length} total`,
    );

    await log.close();

    if (failed > 0) process.exit(1);
}
