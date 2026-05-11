import fsp from 'node:fs/promises';
import chalk from 'chalk';
import { createLogger } from '../logger.js';
import { runPool } from '../pool.js';
import { downloadFile, urlToDestPath } from '../downloader.js';

export async function downloadCommand(opts) {
    const concurrency = parseInt(opts.concurrency || process.env.DOWNLOAD_CONCURRENCY, 10);
    const timeoutMs = parseInt(opts.timeout, 10);
    const log = createLogger(opts.logDir, 'download');

    // Graceful SIGINT — flush the log before exiting
    process.on('SIGINT', async () => {
        log.warn('Interrupted — shutting down');
        await log.close();
        process.exit(130); // 128 + SIGINT(2), POSIX convention
    });

    log.info(`Log: ${log.logPath}`);
    log.info(`Reading URLs from: ${opts.urls}`);

    // ── Read URL list ─────────────────────────────────────────────────────────
    let urls;
    try {
        const text = await fsp.readFile(opts.urls, 'utf8');
        urls = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('--'));
    } catch (err) {
        log.error(`Cannot read URLs file: ${err.message}`);
        log.error('Usage: cadastre download --urls <file>');
        await log.close();
        process.exit(1);
    }

    if (urls.length === 0) {
        log.warn('No URLs found in the file — nothing to do.');
        await log.close();
        return;
    }

    log.info(`Found ${chalk.bold(urls.length)} URLs  |  concurrency: ${concurrency}  |  timeout: ${timeoutMs / 1000}s`);
    log.info(`Saving to: ${opts.out}`);
    log.info('─'.repeat(60));

    await fsp.mkdir(opts.out, { recursive: true });

    // ── Download pool ─────────────────────────────────────────────────────────
    let done = 0;
    let failed = 0;
    const startAll = Date.now();

    await runPool(urls, concurrency, async (rawUrl) => {
        const destPath = urlToDestPath(opts.out, rawUrl);
        // Show only the last meaningful part of the URL for readability
        const label = rawUrl.includes('path=')
            ? decodeURIComponent(rawUrl.split('path=')[1])
            : rawUrl;

        log.info(`↓ ${label}`);
        const t0 = Date.now();

        try {
            const bytes = await downloadFile(rawUrl, destPath, { timeoutMs });
            const kb = (bytes / 1024).toFixed(1);
            const secs = ((Date.now() - t0) / 1000).toFixed(1);
            done++;
            log.ok(`✓ ${label} — ${kb} KB in ${secs}s`);
        } catch (err) {
            failed++;
            log.error(`✗ ${label} — ${err.message}`);
        }
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalSecs = ((Date.now() - startAll) / 1000).toFixed(1);
    log.info('─'.repeat(60));
    log.info(
        `Done in ${totalSecs}s — ` +
        `${chalk.green(`${done} downloaded`)}` +
        (failed ? `, ${chalk.red(`${failed} failed`)}` : '') +
        ` of ${urls.length} total`,
    );

    await log.close();

    // Non-zero exit if any download failed (useful for cron/systemd alerting)
    if (failed > 0) process.exit(1);
}