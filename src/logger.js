import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

const LEVELS = {
    info: { label: 'INF', color: chalk.cyan },
    ok: { label: 'OK ', color: chalk.green },
    warn: { label: 'WRN', color: chalk.yellow },
    error: { label: 'ERR', color: chalk.red },
};

export function createLogger(logDir, prefix = 'log') {
    fs.mkdirSync(logDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const logPath = path.join(logDir, `${prefix}-${stamp}.log`);
    const stream = fs.createWriteStream(logPath, { flags: 'a' });

    function log(level, msg) {
        const ts = new Date().toISOString();
        const { label, color } = LEVELS[level];

        // File: plain text, no ANSI codes
        stream.write(`[${ts}] [${label}] ${msg}\n`);

        // Stdout: colourised
        process.stdout.write(`${chalk.dim(ts)} ${color(`[${label}]`)} ${msg}\n`);
    }

    return {
        info: (msg) => log('info', msg),
        ok: (msg) => log('ok', msg),
        warn: (msg) => log('warn', msg),
        error: (msg) => log('error', msg),
        close: () => new Promise(resolve => stream.end(resolve)),
        logPath,
    };
}