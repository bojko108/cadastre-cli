import fsp from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import shapefile from 'shapefile';
import { createLogger } from '../logger.js';
import { runPool } from '../pool.js';

/**
 * Recursively collects absolute paths to `.shp` files under `rootDir`.
 * Skips shapefile lock files (`.lock`) and anything that isn't a real .shp.
 * @param {string} rootDir
 * @param {string[]} [acc]
 * @returns {Promise<string[]>}
 */
async function collectShpFiles(rootDir, acc = []) {
    const entries = await fsp.readdir(rootDir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(rootDir, ent.name);
        if (ent.isDirectory()) {
            await collectShpFiles(full, acc);
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.shp')) {
            acc.push(full);
        }
    }
    return acc;
}

/**
 * Deletes shapefile sidecars for a given `.shp` path.
 * We intentionally ignore errors (missing files are fine).
 * @param {string} shpPath
 */
async function deleteShapefileParts(shpPath) {
    const dir = path.dirname(shpPath);
    const base = path.basename(shpPath, path.extname(shpPath));
    const exts = [
        '.shp',
        '.shx',
        '.dbf',
        '.prj',
        '.cpg',
        '.qpj',
        '.sbn',
        '.sbx',
        '.fbn',
        '.fbx',
        '.ain',
        '.aih',
        '.ixs',
        '.mxs',
        '.atx',
        '.shp.xml',
        '.xml',
    ];

    await Promise.all(
        exts.map(async (ext) => {
            const p = path.join(dir, `${base}${ext}`);
            try {
                await fsp.unlink(p);
            } catch {
                // ignore
            }
        }),
    );
}

export async function shp2geojsonCommand(opts) {
    let concurrency = parseInt(opts.concurrency ?? process.env.SHP2GEOJSON_CONCURRENCY ?? '4', 10);
    if (!Number.isFinite(concurrency) || concurrency < 1) concurrency = 4;

    const log = createLogger(opts.logDir, 'shp2geojson');
    let failed = 0;

    process.on('SIGINT', async () => {
        log.warn('Interrupted — shutting down');
        await log.close();
        process.exit(130);
    });

    const inDir = path.resolve(opts.in);

    log.info(`Log: ${log.logPath}`);
    log.info(`Scanning for .shp under: ${inDir}`);

    try {
        await fsp.access(inDir);
    } catch {
        log.error(`Input directory not found or not readable: ${inDir}`);
        log.error('Usage: cadastre shp2geojson --in <dir>');
        await log.close();
        process.exit(1);
    }

    const files = await collectShpFiles(inDir);

    if (files.length === 0) {
        log.warn('No .shp files found — nothing to do.');
        await log.close();
        return;
    }

    log.info(`Found ${chalk.bold(files.length)} shapefiles  |  concurrency: ${concurrency}`);
    log.info('─'.repeat(60));

    const startAll = Date.now();
    let done = 0;

    await runPool(files, concurrency, async (shpPath) => {
        const rel = path.relative(inDir, shpPath).replace(/\\/g, '/');
        log.info(`→ ${rel}`);
        const t0 = Date.now();

        try {
            const fc = await shapefile.read(shpPath, undefined, { encoding: 'utf8' });

            if (!fc || fc.type !== 'FeatureCollection') {
                throw new Error('Unexpected GeoJSON output (expected FeatureCollection)');
            }

            const outPath = path.join(
                path.dirname(shpPath),
                `${path.basename(shpPath, path.extname(shpPath))}.geojson`,
            );

            await fsp.writeFile(outPath, `${JSON.stringify(fc)}\n`, 'utf8');
            await deleteShapefileParts(shpPath);

            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            done++;
            log.ok(`✓ ${rel} — ${secs}s`);
        } catch (err) {
            failed++;
            log.error(`✗ ${rel} — ${err.message}`);
        }
    });

    const totalSecs = ((Date.now() - startAll) / 1000).toFixed(1);
    log.info('─'.repeat(60));
    log.info(
        `Done in ${totalSecs}s — ` +
        `${chalk.green(`${done} converted`)}` +
        (failed ? `, ${chalk.red(`${failed} failed`)}` : '') +
        ` of ${files.length} total`,
    );

    await log.close();

    if (failed > 0) process.exit(1);
}

