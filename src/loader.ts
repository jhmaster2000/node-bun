/// <reference types="typings-esm-loader" />
/// <reference types="bun-types" />
import { crlf, LF } from 'crlf-normalize'; //! partial workaround for https://github.com/swc-project/swc/issues/5628
import { NotImplementedError } from './utils.js';
import { fileURLToPath, pathToFileURL } from 'url';
import swc from '@swc/core';
import swcrc from './swcrc.js';
import path from 'path';
import fs from 'fs';

const NO_STACK = () => void 0;
const proc = process as unknown as NodeJS.Process;
const libRoot = path.dirname(fileURLToPath(import.meta.url));
const knownBunModules = ['main', 'sqlite', 'ffi', 'jsc', 'test'];
const importMetaJSURL = pathToFileURL(path.join(libRoot, 'importmeta.js')).href;
const importMetaSetup = `import $__NODEBUN_IMPORTMETA_SETUP__$ from '${importMetaJSURL}';$__NODEBUN_IMPORTMETA_SETUP__$(import.meta);`;
const decoder = new TextDecoder('utf-8');

export async function resolve(...[specifier, context, nextResolve]: Parameters<resolve>): ReturnType<resolve> {
    //! this doesn't work anymore as of Node.js 20, but the other method (in polyfills.ts) is not very good,
    //! so ideally we'd find a way to use the value from the line below again somehow
    //if (context.parentURL === undefined) Bun.main = fileURLToPath(specifier);
    if (specifier === 'bun') return { url: pathToFileURL(path.resolve(libRoot, 'modules', 'bun.js')).href, format: 'module', shortCircuit: true };
    if (specifier.startsWith('bun:')) {
        const module = specifier.slice(4);
        if (!knownBunModules.includes(module)) {
            const err = new Error(`[node-bun] Unknown or unimplemented bun module "${specifier}"`);
            Error.captureStackTrace(err, NO_STACK);
            throw err;
        }

        if (module === 'main') //!return { url: mainURL, shortCircuit: true };
            throw new NotImplementedError('bun:main', NO_STACK); // Causes infinite circular dependency sadly
        if (module === 'sqlite')
            throw new NotImplementedError('bun:sqlite', NO_STACK);
        if (module === 'jsc') proc.emitWarning('Loading polyfill for bun:jsc module.', {
            type: 'NodeBunWarning',
            code: 'NODEBUN_JSC_POLYFILL',
            detail: 'bun:jsc polyfill attempts to translate JSC debug APIs to V8 debug APIs, but is very crude and incomplete, do not use this for serious debugging.',
        });

        return { url: pathToFileURL(path.resolve(libRoot, 'modules', module + '.js')).href, format: 'module', shortCircuit: true };
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

//! indeed, say hello to node.js v20, it broke this
export function globalPreload(): ReturnType<globalPreload> {
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
