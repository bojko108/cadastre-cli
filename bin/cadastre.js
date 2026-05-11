#!/usr/bin/env node

import { program } from 'commander';
import { createRequire } from 'node:module';
import { downloadCommand } from '../src/commands/download.js';
import { unzipCommand } from '../src/commands/unzip.js';

import dotenv from 'dotenv';
dotenv.config();

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

program
    .name('cadastre')
    .description(pkg.description)
    .version(pkg.version, '-v, --version');

program
    .command('download')
    .description('Download ZIP archives listed in a URLs file')
    .requiredOption('-u, --urls <file>', 'path to the .txt file containing URLs (one per line)')
    .option('-o, --out <dir>', 'directory to save downloaded files', './downloads')
    .option('-l, --log-dir <dir>', 'directory to write log files', './logs')
    .option('-c, --concurrency <number>', 'number of parallel downloads', process.env.DOWNLOAD_CONCURRENCY)
    .option('--timeout <ms>', 'per-file HTTP timeout in milliseconds', '120000')
    .action(downloadCommand);

program
    .command('unzip')
    .description('Unzip downloaded files')
    .requiredOption('-i, --in <dir>', 'directory containing ZIP files')
    .option('-o, --out <dir>', 'directory to extract files to', './data')
    .option('-l, --log-dir <dir>', 'directory to write log files', './logs')
    .option('-c, --concurrency <number>', 'number of parallel unzips', process.env.UNZIP_CONCURRENCY)
    .action(unzipCommand);

program.parse();