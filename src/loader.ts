/// <reference types="typings-esm-loader" />
/// <reference types="bun-types" />
import { crlf, LF } from 'crlf-normalize'; //! partial workaround for https://github.com/swc-project/swc/issues/5628
import { type Mutable, NotImplementedError } from './utils.js';
import { fileURLToPath, pathToFileURL } from 'url';
import dummyURL from './dummy.js';
import swc from '@swc/core';
import swcrc from './swcrc.js';
import path from 'path';
import fs from 'fs';

const NO_STACK = () => void 0;
const proc = process as unknown as NodeJS.Process;
const libRoot = path.dirname(fileURLToPath(import.meta.url));
const importMetaJSURL = pathToFileURL(path.join(libRoot, 'importmeta.js')).href;
const importMetaSetup = `import $__NODEBUN_IMPORTMETA_SETUP__$ from '${importMetaJSURL}';$__NODEBUN_IMPORTMETA_SETUP__$(import.meta);`;
const decoder = new TextDecoder('utf-8');
let mainURL: string;

export async function resolve(...[specifier, context, nextResolve]: Parameters<resolve>): ReturnType<resolve> {
    if (context.parentURL === undefined) {
        const bun = globalThis.Bun as Mutable<typeof Bun>;
        mainURL = specifier;
        bun.main = fileURLToPath(mainURL);
        await import('./polyfills.js');
    }
    if (specifier === 'bun') return { url: dummyURL, format: 'bun', shortCircuit: true };
    if (specifier.startsWith('bun:')) {
        if (specifier === 'bun:jsc') return { url: dummyURL, format: specifier, shortCircuit: true };
        if (specifier === 'bun:ffi') return { url: dummyURL, format: specifier, shortCircuit: true };
        if (specifier === 'bun:test') return { url: dummyURL, format: specifier, shortCircuit: true };
        if (specifier === 'bun:sqlite') return { url: dummyURL, format: specifier, shortCircuit: true };
        if (specifier === 'bun:main') //!return { url: mainURL, shortCircuit: true };
            throw new NotImplementedError('bun:main', NO_STACK); // Causes infinite circular dependency sadly
        const err = new Error(`[node-bun] Unknown or unimplemented bun module "${specifier}"`);
        Error.captureStackTrace(err, NO_STACK);
        throw err;
    }
    //console.debug('trying to resolve', specifier, 'from', context.parentURL);
    let next: Resolve.Return | Error;
    let format: string;
    try {
        next = await nextResolve(specifier, context);
        if (next.shortCircuit || next.format === 'builtin' || next.format === 'wasm') return next;
        specifier = next.url;
        format = next.format ?? 'module';
    } catch (err) {
        next = err as Error;
        format = 'module';
    }
    //console.debug('resolved', specifier, 'from', context.parentURL, 'to', next.url);
    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file://')) {
        if (!specifier.startsWith('file://')) {
            const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
            specifier = pathToFileURL(path.resolve(path.dirname(parent), specifier)).href;
        }
        const specifierPath = fileURLToPath(specifier);
        const exists = fs.existsSync(specifierPath);
        if (specifier.endsWith('.ts') && exists) return { url: specifier, format: 'ts' + format, shortCircuit: true };
        if (specifier.endsWith('.js') && exists) return { url: specifier, format, shortCircuit: true };
        if (specifier.endsWith('.ts') && fs.existsSync(specifierPath.slice(0, -3) + '.js')) return { url: specifier.slice(0, -3) + '.js', format, shortCircuit: true };
        if (specifier.endsWith('.js') && fs.existsSync(specifierPath.slice(0, -3) + '.ts')) return { url: specifier.slice(0, -3) + '.ts', format: 'ts' + format, shortCircuit: true };
        if (fs.existsSync(specifierPath + '.ts')) return { url: specifier + '.ts', format: 'ts' + format, shortCircuit: true };
        if (fs.existsSync(specifierPath + '.js')) return { url: specifier + '.js', format, shortCircuit: true };
        if (fs.existsSync(specifierPath + '.json')) return { url: specifier + '.json', format: 'json', shortCircuit: true };
        if (fs.existsSync(specifierPath + '/index.ts')) return { url: specifier + '/index.ts', format: 'ts' + format, shortCircuit: true };
        if (fs.existsSync(specifierPath + '/index.js')) return { url: specifier + '/index.js', format, shortCircuit: true };
        if (fs.existsSync(specifierPath + '/index.json')) return { url: specifier + '/index.json', format: 'json', shortCircuit: true };
    }
    if (next instanceof Error) throw next;
    else return next;
}

export async function load(...[url, context, nextLoad]: Parameters<load>): ReturnType<load> {
    if (url === dummyURL) {
        switch (context.format) {
            case 'bun':
                return { shortCircuit: true, format: 'module', source: 'export default globalThis.Bun;' };
            case 'bun:jsc':
                proc.emitWarning('Loading polyfill for bun:jsc module.', {
                    type: 'NodeBunWarning',
                    code: 'NODEBUN_JSC_POLYFILL',
                    detail: 'bun:jsc polyfill attempts to translate JSC debug APIs to V8 debug APIs, but is very crude and incomplete, do not use this for serious debugging.',
                });
                return { shortCircuit: true, format: 'module', source: `export { default } from "${pathToFileURL(path.resolve(libRoot, 'jsc.js')).href}";` };
            case 'bun:ffi':
                throw new NotImplementedError('bun:ffi', NO_STACK); // TODO: @see src/ffi.ts
                return { shortCircuit: true, format: 'module', source: `export { default } from "${pathToFileURL(path.resolve(libRoot, 'ffi.js')).href}";` };
            case 'bun:sqlite':
                throw new NotImplementedError('bun:sqlite', NO_STACK); // TODO
                return { shortCircuit: true, format: 'module', source: `export { default } from "${pathToFileURL(path.resolve(libRoot, 'sqlite.js')).href}";` };
            case 'bun:test':
                throw new NotImplementedError(
                    'A polyfill for bun:test will not be implemented as it\'s considered out of scope.',
                    NO_STACK, true
                );
        }
    }
    if (context.format === 'tsmodule' || context.format === 'tscommonjs') {
        const filepath = fileURLToPath(url);
        swcrc.filename = path.basename(filepath);
        const src = fs.readFileSync(filepath, 'utf-8');
        const js = swc.transformSync(importMetaSetup + crlf(src, LF), swcrc).code || ';';
        return { shortCircuit: true, format: context.format.slice(2) as ModuleFormat, source: js };
    }
    if (context.format === 'json') context.importAssertions.type = 'json';
    const loaded = await nextLoad(url, context);
    if (url.startsWith('file://') && loaded.format === 'module') {
        const src = typeof loaded.source === 'string' ? loaded.source : decoder.decode(loaded.source);
        return { shortCircuit: true, format: 'module', source: importMetaSetup + src };
    }
    else return loaded;
}

//! this may not work forever if Node.js changes this code to actually run in a different context as the docs claim (it currently doesn't as of 19.0.0)
export function globalPreload(): ReturnType<globalPreload> {
    Reflect.set(globalThis, 'Bun', {});
    if (process.argv[1] === undefined) {
        void import('./polyfills.js').then(() => console.info(
            `\n(node:${process.pid}) [NODEBUN_LOADED] node-bun loader has finished loading into the REPL.\n`
        ));
        proc.emitWarning('node-bun in loader mode is lazy-loaded on a REPL context. Please wait for the node-bun loaded message.', {
            type: 'NodeBunWarning',
            code: 'NODEBUN_LAZY_REPL',
            detail: 'To synchronously load node-bun into the REPL, use --repl-sync (Node.js 19+ only) (No TS support).\n',
        });
        Reflect.set(Bun, 'main', path.join(process.cwd(), 'repl'));
    }
    return `
    if (!process.noProcessWarnings) process.removeAllListeners('warning');
    process.on('warning', ${onWarning.toString()});`;
}

// Taken directly from Node.js, modified
function onWarning(warning: Error & { code?: string, detail?: string }) {
    if (!(warning instanceof Error)) return;
    if (warning.name === 'ExperimentalWarning' || process.env.NODEBUN_TRUE_NO_WARNINGS) return;
    const isDeprecation = warning.name === 'DeprecationWarning';
    if (isDeprecation && Reflect.get(process, 'noDeprecation')) return;
    const trace = Reflect.get(process, 'traceProcessWarnings') as boolean || (isDeprecation && Reflect.get(process, 'traceDeprecation')) as boolean;
    let msg = `(${Reflect.get(Reflect.get(process, 'release') as object, 'name') as string}:${process.pid}) `;
    if (warning.code) msg += `[${warning.code}] `;
    if (trace && warning.stack) msg += `${warning.stack}`;
    else msg += typeof warning.toString === 'function' ? `${warning.toString()}` : Error.prototype.toString.call(warning);
    if (typeof warning.detail === 'string') msg += `\n${warning.detail}`;
    if (!trace && !Reflect.get(onWarning, 'traceWarningHelperShown') && warning.name !== 'NodeBunWarning') {
        const flag = isDeprecation ? '--trace-deprecation' : '--trace-warnings';
        const argv0 = path.basename(process.argv0 || 'node', '.exe');
        msg += `\n(Use \`${argv0} ${flag} ...\` to show where the warning ` + 'was created)';
        Reflect.set(onWarning, 'traceWarningHelperShown', true);
    }
    console.warn(msg);
}