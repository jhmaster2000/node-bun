#!/usr/bin/env node
import url from 'url';
import path from 'path';
import chp from 'child_process';

if (+process.versions.node.split('.')[0] < 20) {
    console.error(`error: node-bun requires Node.js 20.2.0+ (using ${process.versions.node})`);
    process.exit(1);
}
if (process.versions.node === '20.0.0' || process.versions.node === '20.1.0') {
    console.error(
        'error: Node.js 20.0.0 and 20.1.0 are not supported due to a bug in Node.js itself with ESM loaders.\n' +
        `       Please upgrade to Node.js 20.2.0 or newer. (using ${process.versions.node})`
    );
    process.exit(1);
}
if (+process.versions.node.split('.')[0] > 20) {
    console.warn(
        'warning: Node.js 21+ is untested and not yet officially supported by node-bun.\n' +
        `         Please report any issues you encounter. (using ${process.versions.node})`
    );
}

const argv = process.argv.slice(2);
const root = path.dirname(url.fileURLToPath(import.meta.url));

const fileIndex = argv.findIndex(arg => !arg.startsWith('-'));
if (fileIndex === -1) {
    if (argv.length === 0) {
        console.info(
            `Usage: node-bun [node-bun/node options] <file> [arguments]\n` +
            `Options not recognized by node-bun will be passed to node.\n\n` +
            `node-bun recognized options:\n` +
            `   --info                  Display node-bun information such as version\n` +
            `   --repl                  Open Node.js REPL with node-bun loaded (Overrides all options except --info).\n` +
            `   --no-gc                 Do not expose the global Node.js gc() function required for Bun.gc()\n` +
            `   --no-dotenv             Do not automatically load .env\n` +
            `   --esm-loader-warning    Do not suppress the custom ESM loaders warning\n\n` +
            `Further documentation can be found from the README.`
        );
        process.exit(0);
    }
    if (argv.includes('--info')) {
        const fs = await import('fs');
        const pkg = JSON.parse(fs.readFileSync(path.resolve(root, '..', 'package.json'), 'utf8')) as Record<string, unknown>;
        console.info(
            `node-bun v${pkg.version as string}\n` +
            `Node.js v${process.versions.node}\n`
        );
        process.exit(0);
    }
    if (argv.includes('--repl') || argv.includes('-i') || argv.includes('--interactive')) {
        chp.spawnSync(process.argv[0], [
            '-i', '--enable-source-maps', '--no-warnings', '--expose-gc',
            `--loader=${url.pathToFileURL(path.resolve(root, 'loader.js')).href}`,
            `--import=${url.pathToFileURL(path.resolve(root, 'polyfills.js')).href}`,
        ], { stdio: 'inherit' });
        process.exit(0);
    }
    console.error('error: no file specified');
    process.exit(1);
}
const file = argv[fileIndex];
const execArgv = argv.slice(0, fileIndex);
const childArgv = argv.slice(fileIndex + 1);
const settings: Record<string, any> = {};

const TRUE = '1' as const;
let ix: number;
if ((ix = execArgv.indexOf('--no-gc')) !== -1) {
    settings.NODEBUN_NO_GC = TRUE;
    execArgv.splice(ix, 1);
}
if ((ix = execArgv.indexOf('--no-dotenv')) !== -1) {
    settings.NODEBUN_NO_DOTENV = TRUE;
    execArgv.splice(ix, 1);
}
if ((ix = execArgv.indexOf('--esm-loader-warning')) !== -1) {
    settings.NODEBUN_ESM_LOADER_WARN = TRUE;
    execArgv.splice(ix, 1);
}
if ((ix = execArgv.indexOf('--no-warnings')) !== -1) settings.NODEBUN_TRUE_NO_WARNINGS = TRUE;

let dotenv = 'dotenv/config';
if (!settings.NODEBUN_NO_DOTENV) {
    const { createRequire } = (await import('module')).default;
    const { resolve } = createRequire(import.meta.url);
    try { dotenv = resolve('dotenv/config'); } catch {
        console.warn(`warning: dotenv/config package not found, skipping .env loading`);
        settings.NODEBUN_NO_DOTENV = TRUE;
    }
}

const NO_ARG = [] as const;
chp.fork(file, childArgv, {
    stdio: 'inherit',
    execArgv: [
        '--enable-source-maps',
        settings.NODEBUN_ESM_LOADER_WARN ? NO_ARG : '--no-warnings',
        settings.NODEBUN_NO_GC ? NO_ARG : '--expose-gc',
        settings.NODEBUN_NO_DOTENV ? NO_ARG : ['-r', dotenv],
        `--loader=${url.pathToFileURL(path.resolve(root, 'loader.js')).href}`,
        `--import=${url.pathToFileURL(path.resolve(root, 'polyfills.js')).href}`,
        ...execArgv
    ].flat(),
    env: { ...process.env, ...settings }
}).disconnect();
