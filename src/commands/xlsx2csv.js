import fsp from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import XLSX from 'xlsx';
import { createLogger } from '../logger.js';
import { runPool } from '../pool.js';

/**
 * Recursively collects absolute paths to `.xlsx` files under `rootDir`.
 * Skips Excel lock files (`~$…`).
 * @param {string} rootDir
 * @param {string[]} [acc]
 * @returns {Promise<string[]>}
 */
async function collectXlsxFiles(rootDir, acc = []) {
    const entries = await fsp.readdir(rootDir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(rootDir, ent.name);
        if (ent.isDirectory()) {
            await collectXlsxFiles(full, acc);
        } else if (
            ent.isFile() &&
            ent.name.toLowerCase().endsWith('.xlsx') &&
            !ent.name.startsWith('~$')
        ) {
            acc.push(full);
        }
    }
    return acc;
}

/**
 * @param {string} name
 * @returns {string}
 */
function sanitizeSheetSlug(name) {
    const cleaned = name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/^\.+/, '')
        .trim();
    return cleaned || 'sheet';
}

/**
 * @param {string} slug
 * @param {Set<string>} used
 * @returns {string}
 */
function uniqueSlug(slug, used) {
    let s = slug;
    let n = 1;
    while (used.has(s)) {
        s = `${slug}_${n++}`;
    }
    used.add(s);
    return s;
}

export async function xlsx2csvCommand(opts) {
    let concurrency = parseInt(opts.concurrency ?? process.env.XLSX2CSV_CONCURRENCY ?? '4', 10);
    if (!Number.isFinite(concurrency) || concurrency < 1) concurrency = 4;

    const log = createLogger(opts.logDir, 'xlsx2csv');
    let failed = 0;

    process.on('SIGINT', async () => {
        log.warn('Interrupted — shutting down');
        await log.close();
        process.exit(130);
    });

    const inDir = path.resolve(opts.in);

    log.info(`Log: ${log.logPath}`);
    log.info(`Scanning for .xlsx under: ${inDir}`);

    try {
        await fsp.access(inDir);
    } catch {
        log.error(`Input directory not found or not readable: ${inDir}`);
        log.error('Usage: cadastre xlsx2csv --in <dir>');
        await log.close();
        process.exit(1);
    }

    const files = await collectXlsxFiles(inDir);

    if (files.length === 0) {
        log.warn('No .xlsx files found — nothing to do.');
        await log.close();
        return;
    }

    log.info(`Found ${chalk.bold(files.length)} spreadsheets  |  concurrency: ${concurrency}`);
    log.info('─'.repeat(60));

    const startAll = Date.now();
    let done = 0;

    await runPool(files, concurrency, async (xlsxPath) => {
        const rel = path.relative(inDir, xlsxPath).replace(/\\/g, '/');
        log.info(`↓ ${rel}`);
        const t0 = Date.now();

        try {
            const buf = await fsp.readFile(xlsxPath);
            const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
            const names = workbook.SheetNames;

            if (names.length === 0) {
                log.warn(`✗ ${rel} — workbook has no sheets (left unchanged)`);
                failed++;
                return;
            }

            const dir = path.dirname(xlsxPath);
            const base = path.basename(xlsxPath, path.extname(xlsxPath));
            const slugUsed = new Set();

            for (const sheetName of names) {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' });
                const body = csv.endsWith('\n') ? csv : `${csv}\n`;

                let outName;
                if (names.length === 1) {
                    outName = `${base}.csv`;
                } else {
                    log.warn(`  multiple sheets found: ${sheetName}`);
                    const slug = uniqueSlug(sanitizeSheetSlug(sheetName), slugUsed);
                    outName = `${base}__${slug}.csv`;
                }

                const outPath = path.join(dir, outName);
                await fsp.writeFile(outPath, body, 'utf8');
            }

            await fsp.unlink(xlsxPath);

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
