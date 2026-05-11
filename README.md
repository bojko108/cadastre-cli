# cadastre-cli

A Node.js CLI for downloading, unpacking and processing of open data from Bulgarian Cadastral Agency (URL lists and mirrored folder layout).

---

## Requirements

- **Node.js** 22 or newer (`engines` in `package.json`)
- **npm** (for installing dependencies)

---

## Install

```bash
npm install
```

Run the CLI without a global install:

```bash
node bin/cadastre.js --help
```

Optional global command (same on Windows and Unix after `npm link`):

```bash
chmod +x bin/cadastre.js   # Unix only — optional
npm link                   # installs the `cadastre` command from this package
```

The entry point loads **dotenv** if present, so you can tune concurrency via a local `.env` (for example `DOWNLOAD_CONCURRENCY` and `UNZIP_CONCURRENCY`). Do not commit secrets.

---

## Commands

### `download`

Reads a text file of URLs (one per line), downloads each archive under `--out`, and preserves a directory layout derived from each URL’s `path=` segment (spaces normalized to underscores), same as before.

| Option | Description | Default |
|--------|-------------|---------|
| `-u, --urls <file>` | Path to `.txt` file listing URLs (**required**) | — |
| `-o, --out <dir>` | Directory for downloaded `.zip` files | `./downloads` |
| `-l, --log-dir <dir>` | Directory for log files | `./logs` |
| `-c, --concurrency <n>` | Parallel downloads | Taken from `DOWNLOAD_CONCURRENCY` when the CLI starts, if set; otherwise pass `-c` (e.g. `5`) |
| `--timeout <ms>` | Per-request HTTP timeout | `120000` |

Lines in the URL file that are empty or start with `--` are skipped.

Example (repo includes lists under `configs/`):

```bash
cadastre download --urls ./configs/files.test.txt
cadastre download --urls ./configs/files.all.txt --out ./downloads --log-dir ./logs --concurrency 5 --timeout 120000
```

### `unzip`

Recursively finds every `.zip` under `--in`, then extracts each archive so the **relative path from `--in` is preserved**, and the contents go into a **folder named like the archive without `.zip`** under `--out`.

Example:

- File: `downloads/област_Пример/община_Пример/гр._Пример_(00000)/сгради.zip`
- Extracted to: `data/област_Пример/община_Пример/гр._Пример_(00000)/сгради/` (files from the zip live inside that folder)

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --in <dir>` | Root directory to scan for `.zip` files (**required**) | — |
| `-o, --out <dir>` | Root directory for extracted data | `./data` |
| `-l, --log-dir <dir>` | Directory for log files | `./logs` |
| `-c, --concurrency <n>` | Parallel extractions | Taken from `UNZIP_CONCURRENCY` when the CLI starts, if set; otherwise pass `-c` (e.g. `4`) |

```bash
cadastre unzip --in ./downloads --out ./data
cadastre unzip --in ./downloads --out ./data --log-dir ./logs --concurrency 4
```

Extraction uses the [`extract-zip`](https://www.npmjs.com/package/extract-zip) package (no external `unzip` binary required).

---

## npm scripts

| Script | Purpose (see `package.json` for additional flags) |
|--------|---------|
| `npm start` | Prints `download --help` |
| `npm fetch-test` | Sample download using `configs/files.test.txt` |
| `npm run fetch-all` | Download all URLs from `configs/files.all.txt` |
| `npm run unzip-test` | Sample unzip `./downloads_test` → `./data_test` |
| `npm run unzip` | Unzip `./downloads` → `./data` (see `package.json` for exact flags) |

---

## Logs

Each run creates a timestamped log under `--log-dir`:

- `download-*.log` for `cadastre download`
- `unzip-*.log` for `cadastre unzip`

The same lines are printed to the terminal (with colour).

---

## Help

```bash
cadastre --help
cadastre download --help
cadastre unzip --help
```

---

## Project layout

```
bin/cadastre.js          ← CLI entry (Commander + dotenv)
configs/                 ← example URL lists (e.g. files.test.txt, files.all.txt)
src/
  commands/download.js   ← `download` command
  commands/unzip.js      ← `unzip` command
  downloader.js          ← HTTP download, URL → path, redirect limit
  pool.js                ← bounded concurrency worker pool
  logger.js              ← stdout + file logging
package.json
```

---

## Exit status

If any download or unzip operation fails, the command exits with code **1** after logging errors (useful for scripts and schedulers).
