/// <reference types="bun-types" />
import type { EditorOptions, HeapSnapshot, SpawnOptions, Subprocess, SyncSubprocess, FileBlob as BunFileBlob, ArrayBufferView } from 'bun';
import type { V8HeapSnapshot } from './v8heapsnapshot.js';
import type { TextDecoderStream } from 'stream/web';
import type { ChildProcess, StdioOptions, SpawnSyncReturns } from 'child_process';
import type { SystemError } from './systemerror.js';
import type { Mutable } from './utils.js';
import type which from 'which';

declare global {
    interface Process {
        /** node-bun specific, undefined on both plain Node and Bun */
        readonly isNodeBun: 1 | undefined;
    }
}

declare module 'bun' {
    let assetPrefix: string;
    let routesDir: undefined;
    let argv: string[];
}

// If already running on Bun, then we don't need to do anything
if (process.isBun === undefined) {
    const dns = (await import('./dns.js')).default;
    const fs = await import('fs');
    const os = await import('os');
    const v8 = (await import('v8')).default;
    const which = await import('which');
    const openEditor = (await import('open-editor')).default;
    const { random } = await import('./mathrandom.js');
    const { FileSink } = await import('./filesink.js');
    const { fromWebReadableStream, isArrayBufferView, toWebReadableStream } = await import('./utils.js');
    const { bunHash, bunHashProto, MD4, MD5, SHA1, SHA224, SHA256, SHA384, SHA512, SHA512_256 } = await import('./hashes.js');
    const { NodeJSStreamFileBlob } = await import('./fileblob.js');
    const { getter, NotImplementedError, readonly, SegmentationFault, streamToBuffer } = await import('./utils.js');
    const { fileURLToPath, pathToFileURL } = await import('url');
    const Transpiler = (await import('./transpiler.js')).default;
    const cryptoPolyfill = (await import('./crypto.js')).default;
    const { ArrayBufferSink } = await import('./arraybuffersink.js');
    const { FileBlob } = await import('./fileblob.js');
    const { mmaper } = await import('./mmap.js');
    const nodegc = (await import('./gc.js')).default;
    const chp = await import('child_process');
    const zlib = await import('zlib');
    const path = await import('path');
    const util = await import('util');
    const root = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.resolve(root, '..', 'package.json'), 'utf8')) as Record<string, unknown>;
    const pkgver = (<string>pkg.version).split('-')[0];

    const proc = process as unknown as NodeJS.Process;
    // Allows loading either through the loader or directly importing this file
    // If loaded through the loader, then the loader will create the object
    // If loaded directly, then we must create the object here aswell as Bun.main with a different, less reliable method
    if (globalThis.Bun === undefined) {
        globalThis.Bun = {
            main: path.resolve(proc.cwd(), process.argv[1] ?? 'repl')
        } as typeof Bun;
    }
    const bun = globalThis.Bun as Mutable<typeof Bun>;

    // process polyfills
    process.isBun = 1;
    Reflect.set(process, 'browser', 0);
    Reflect.set(process, 'isNodeBun', 1); //? node-bun specific
    const NULL_VERSION = '0'.repeat(39) + '1';
    process.versions.bun = pkgver;
    process.versions.nodebun = pkg.version as string; //? node-bun specific
    process.versions.webkit = NULL_VERSION;
    process.versions.mimalloc = NULL_VERSION;
    process.versions.libarchive = NULL_VERSION;
    process.versions.picohttpparser = NULL_VERSION;
    process.versions.boringssl = NULL_VERSION;
    process.versions.zig = '0.10.0';
    (<Mutable<typeof process>>process).revision = NULL_VERSION;

    // Bun polyfills
    bun.version = pkgver;
    bun.revision = process.revision;
    getter(bun, 'cwd', proc.cwd);
    bun.origin = '';
    // @ts-expect-error ---
    bun.stdin = new NodeJSStreamFileBlob(proc.stdin);
    // @ts-expect-error ---
    bun.stdout = new NodeJSStreamFileBlob(proc.stdout);
    // @ts-expect-error ---
    bun.stderr = new NodeJSStreamFileBlob(proc.stderr);
    bun.routesDir = undefined;
    bun.assetPrefix = '';
    bun.argv = [proc.argv0, ...proc.execArgv, ...proc.argv.slice(1)];
    bun.env = process.env;
    Object.setPrototypeOf(bun.env, {
        toJSON(this: typeof bun.env) { return { ...this }; }
    });
    // @ts-expect-error supports-color types are unbelievably bad
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    readonly(bun, 'enableANSIColors', (await import('supports-color')).createSupportsColor().hasBasic);
    bun.Transpiler = Transpiler;
    bun.hash = bunHash;
    Object.setPrototypeOf(bun.hash, bunHashProto);
    // bun.TOML (undocumented)
    bun.unsafe = {} as typeof Bun['unsafe'];
    bun.unsafe.arrayBufferToString = (buf) => new TextDecoder().decode(buf);
    bun.unsafe.segfault = () => {
        const segfault = new SegmentationFault();
        segfault.name = 'SegfaultTest';
        segfault.message = '';
        console.error(segfault);
        process.exit(1);
    };
    bun.SHA1 = SHA1;
    bun.MD5 = MD5;
    bun.MD4 = MD4;
    bun.SHA224 = SHA224;
    bun.SHA512 = SHA512;
    bun.SHA384 = SHA384;
    bun.SHA256 = SHA256;
    bun.SHA512_256 = SHA512_256;
    // bun.FFI (undocumented)
    // bun.match (undocumented)
    bun.sleepSync = (s: number) => {
        if (!s || s < 0) throw new RangeError('sleepSync() argument must be a positive number');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);
    };
    // bun.fetch (undocumented)
    // bun.getImportedStyles (undocumented)
    //? This is not 1:1 matching, but no one should be relying on the exact output of this function anyway.
    //? To quote Node's inspect itself: "The output of util.inspect() may change at any time and should not be depended upon programmatically."
    bun.inspect = (arg: any): string => util.inspect(arg, {
        breakLength: Infinity,
        colors: false,
        compact: true,
        customInspect: false,
        depth: Infinity,
        getters: true,
        maxArrayLength: Infinity,
        maxStringLength: Infinity,
        showHidden: false,
        showProxy: false,
        sorted: false
    });
    // bun.getRouteFiles (undocumented)
    // bun._Os (undocumented)
    // bun._Path (undocumented)
    // bun.getRouteNames (undocumented)
    // bun.readFile (undocumented)
    bun.resolveSync = (id: string, parent: string) => import.meta.resolveSync(id, parent);
    bun.resolve = async (id: string, parent: string) => import.meta.resolve!(id, parent);
    // bun.readFileBytes (undocumented)
    // bun.getPublicPath (undocumented)
    // bun.registerMacro (undocumented)
    // bun.fs (undocumented)
    // bun.jest (undocumented)
    bun.gc = nodegc!;
    bun.allocUnsafe = (size: number) => new Uint8Array(size); //? Yes, this is faster than new Uint8Array(Buffer.allocUnsafe(size).buffer) by about 2.5x in Node.js
    bun.mmap = mmaper;
    // @ts-expect-error Refer to the warning within the function below.
    bun.generateHeapSnapshot = async (): Promise<HeapSnapshot> => {
        proc.emitWarning('The polyfill for Bun.generateHeapShot is asynchronous, unlike the original which is synchronous.', {
            type: 'NodeBunWarning',
            code: 'NODEBUN_ASYNC_GENERATE_HEAP_SNAPSHOT',
            detail: 'This is due to v8.getHeapSnapshot() returning a stream in Node.js. This is not a bug, but a limitation of the polyfill.'
        });
        const raw = (await streamToBuffer(v8.getHeapSnapshot())).toString('utf8');
        const json = JSON.parse(raw) as V8HeapSnapshot;
        return {
            version: 2 as unknown as string,
            type: 'Inspector',
            nodes: json.nodes,
            edges: json.edges,
            edgeTypes: json.snapshot.meta.edge_types.flat(),
            edgeNames: json.snapshot.meta.edge_fields.flat(),
            nodeClassNames: json.snapshot.meta.node_types.flat(),
        };
    };
    bun.shrink = () => void 0; //! This is a no-op in Node.js, as there is no way to shrink the V8 heap from JS as far as I know.
    bun.openInEditor = (file: string, opts?: EditorOptions) => {
        const target = [{ file: path.resolve(process.cwd(), file), line: opts?.line, column: opts?.column }] as const;
        if (opts?.editor) openEditor(target, opts);
        else openEditor(target, { editor: process.env.TERM_PROGRAM ?? process.env.VISUAL ?? process.env.EDITOR ?? 'vscode' });
    };
    // bun.readAllStdinSync (undocumented)
    bun.serve = () => { throw new NotImplementedError('Bun.serve', bun.serve); };
    bun.file = (path: string | URL | Uint8Array | ArrayBufferLike | number, options?: BlobPropertyBag): BunFileBlob => {
        if (typeof path === 'object') throw new NotImplementedError('Bun.file with typed array', bun.file);
        return new FileBlob(path, options);
    };
    bun.write = async (dest: BunFileBlob | PathLike, input: string | Blob | TypedArray | ArrayBufferLike | BlobPart[] | Response | BunFileBlob) => {
        if (!isFileBlob(dest)) {
            let fd: number;
            if (dest instanceof ArrayBuffer || dest instanceof SharedArrayBuffer) fd = fs.openSync(Buffer.from(dest), 'w');
            else if (typeof dest === 'string' || dest instanceof URL) fd = fs.openSync(dest, 'w');
            else fd = fs.openSync(Buffer.from(dest.buffer), 'w');

            if (input instanceof Response || input instanceof Blob) {
                const data = await input.text();
                return new Promise((resolve, reject) => {
                    fs.write(fd, data, (err, written) => err ? reject(err) : resolve(written));
                });
            }
            if (Array.isArray(input)) {
                const data = await new Blob(input).text();
                return new Promise((resolve, reject) => {
                    fs.write(fd, data, (err, written) => err ? reject(err) : resolve(written));
                });
            }
            return new Promise((resolve, reject) => {
                if (typeof input === 'string') return fs.write(fd, input, (err, written) => err ? reject(err) : resolve(written));
                if (input instanceof Uint8Array) return fs.write(fd, input, (err, written) => err ? reject(err) : resolve(written));
                if (input instanceof ArrayBuffer) return fs.write(fd, new Uint8Array(input), (err, written) => err ? reject(err) : resolve(written));
                if (input instanceof SharedArrayBuffer) return fs.write(fd, new Uint8Array(input), (err, written) => err ? reject(err) : resolve(written));
                return bun.write(dest, String(input)); // if all else fails, it seems Bun tries to convert to string and write that.
            });
        } else {
            const writer = dest.writer();
            if (Array.isArray(input)) input = new Blob(input);
            if (input instanceof Blob || input instanceof Response) return writer.write(await input.arrayBuffer());
            if (input instanceof ArrayBuffer || input instanceof SharedArrayBuffer || ArrayBuffer.isView(input)) return writer.write(input);
            if (typeof input === 'string') return writer.write(input);
            else return bun.write(dest, String(input)); // if all else fails, it seems Bun tries to convert to string and write that.
        }
    };
    // @ts-expect-error bun-types mistake (TypedArray should be Uint8Array on bun.SHA512_256.hash)
    bun.sha = (...args) => bun.SHA512_256.hash(...args);
    bun.nanoseconds = () => Math.trunc(performance.now() * 1000000);
    //? This just prints out some debug stuff in console, and as the name implies no one should be using it.
    //? But, just in case someone does, we'll make it a no-op function so at least the program doesn't crash trying to run the function.
    Reflect.set(bun, 'DO_NOT_USE_OR_YOU_WILL_BE_FIRED_mimalloc_dump', () => {
        console.warn('DO_NOT_USE_OR_YOU_WILL_BE_FIRED_mimalloc_dump called.');
    });
    bun.gzipSync = zlib.gzipSync;
    bun.deflateSync = zlib.deflateSync;
    bun.gunzipSync = zlib.gunzipSync;
    bun.inflateSync = zlib.inflateSync;
    // @ts-expect-error sigh still dealing with wrong bun-types, it doesnt include null on the return type...
    bun.which = (cmd: string, options) => {
        const opts: which.Options = { all: false, nothrow: true };
        if (options?.PATH) opts.path = options.PATH;
        const result = which.sync(cmd, opts) as string | null;
        if (!result || !options?.cwd) return result;
        if (path.normalize(result).includes(path.normalize(options.cwd))) return result;
        else return null;
    };
    bun.spawn = (...args) => {
        let cmd: string;
        let argv: string[];
        let opts: SpawnOptions.OptionsObject;

        if (args[0] instanceof Array) {
            cmd = args[0][0];
            argv = args[0].slice(1);
            opts = isOptions(args[1]) ? args[1] : {};
        } else {
            cmd = args[0].cmd[0];
            argv = args[0].cmd.slice(1);
            opts = args[0];
            Reflect.deleteProperty(opts, 'cmd');
        }

        let stdio: StdioOptions = [];
        opts.stdio ??= [undefined, undefined, undefined];
        if (opts.stdin) opts.stdio[0] = opts.stdin;
        if (opts.stdout) opts.stdio[1] = opts.stdout;
        if (opts.stderr) opts.stdio[2] = opts.stderr;
        for (let i = 1; i < 3; i++) { // this intentionally skips stdin
            let std = opts.stdio[i];
            if (isArrayBufferView(std)) stdio[i] = fromWebReadableStream(new Blob([std]).stream());
            else if (std instanceof Blob || isFileBlob(std)) stdio[i] = fromWebReadableStream(std.stream());
            else if (std instanceof ReadableStream) stdio[i] = fromWebReadableStream(std);
            else if (std instanceof Response || std instanceof Request) stdio[i] = fromWebReadableStream(std.body!);
            else stdio[i] = std;
        }
        let stdinSrc: typeof opts.stdio[0] = null;
        if (opts.stdio[0] && typeof opts.stdio[0] !== 'string') {
            stdinSrc = opts.stdio[0];
            stdio[0] = 'pipe';
        }

        const subp = chp.spawn(cmd, argv, {
            cwd: opts.cwd ?? process.cwd(),
            // why is this set to (string | number) on env values...
            env: { ...(opts.env as Record<string, string> ?? process.env) },
            stdio
        }) as unknown as Subprocess;
        const subpAsNode = subp as unknown as ChildProcess;
        const streams = [subpAsNode.stdin, subpAsNode.stdout, subpAsNode.stderr] as const;
        if (subpAsNode.stdout) {
            const rstream = toWebReadableStream(subpAsNode.stdout);
            Reflect.set(rstream, 'destroy', function (this: ReadableStream, err?: Error) {
                void (err ? this.cancel(String(err)) : this.cancel()).catch(() => { /* if it fails its already closed */ });
                return this;
            });
            (<Mutable<Subprocess>>subp).stdout = rstream;
        }
        if (subpAsNode.stderr) {
            const rstream = toWebReadableStream(subpAsNode.stderr);
            Reflect.set(rstream, 'destroy', function (this: ReadableStream, err?: Error) {
                void (err ? this.cancel(String(err)) : this.cancel()).catch(() => { /* if it fails its already closed */ });
                return this;
            });
            (<Mutable<Subprocess>>subp).stderr = rstream;
        }
        if (subpAsNode.stdin) {
            const wstream = subpAsNode.stdin;
            Reflect.set(wstream, 'destroy', function (this: NodeJS.WritableStream, err?: Error) {
                void this.end(); /* if it fails its already closed */
                return this;
            });
            (<Mutable<Subprocess>>subp).stdin = new FileSink(wstream);

        }
        Object.defineProperty(subp, 'readable', { get(this: Subprocess) { return this.stdout; } });
        Object.defineProperty(subp, 'exited', {
            value: new Promise((resolve, reject) => {
                subpAsNode.once('exit', (code) => {
                    streams[0]?.destroy();
                    streams[1]?.destroy();
                    streams[2]?.destroy();
                    subp.kill();
                    subp.unref();
                    subpAsNode.disconnect?.();
                    subpAsNode.removeAllListeners();
                    resolve(code);
                });
            })
        });
        if (stdinSrc) subpAsNode.once('spawn', () => {
            const stdin = subp.stdin as unknown as WritableStream;
            if (isArrayBufferView(stdinSrc)) stdinSrc = new Blob([stdinSrc]);
            if (stdinSrc instanceof Blob) void stdinSrc.stream().pipeTo(stdin as WritableStream<Uint8Array>);
            else if (stdinSrc instanceof Response || stdinSrc instanceof Request) void stdinSrc.body!.pipeTo(stdin);
            else if (typeof stdinSrc === 'number') void fs.createReadStream('', { fd: stdinSrc }).pipeTo(stdin);
            else void stdinSrc;
        });
        // change the error stack to point to the spawn() call instead of internal Node.js callback stuff
        const here = new Error('§__PLACEHOLDER__§');
        Error.captureStackTrace(here, bun.spawn);
        if (!subpAsNode.pid) return subpAsNode.once('error', (err: SystemError) => {
            err.message = (err.syscall ?? `spawn ${err.path ?? ''}`) + ' ' + (err.code ?? String(err.errno ?? ''));
            err.stack = here.stack!.replace('§__PLACEHOLDER__§', err.message);
            throw err;
        }) as unknown as Subprocess;
        return subp;
    };
    bun.spawnSync = (...args): SyncSubprocess => {
        let cmd: string;
        let argv: string[];
        let opts: SpawnOptions.OptionsObject;
        if (args[0] instanceof Array) {
            cmd = args[0][0];
            argv = args[0].slice(1);
            opts = isOptions(args[1]) ? args[1] : {};
        } else {
            cmd = args[0].cmd[0];
            argv = args[0].cmd.slice(1);
            opts = args[0];
            Reflect.deleteProperty(opts, 'cmd');
        }

        let stdio: StdioOptions = [];
        opts.stdio ??= [undefined, undefined, undefined];
        if (opts.stdin) opts.stdio[0] = opts.stdin;
        if (opts.stdout) opts.stdio[1] = opts.stdout;
        if (opts.stderr) opts.stdio[2] = opts.stderr;
        for (let i = 1; i < 3; i++) { // this intentionally skips stdin
            let std = opts.stdio[i];
            if (isArrayBufferView(std)) stdio[i] = fromWebReadableStream(new Blob([std]).stream());
            else if (std instanceof Blob || isFileBlob(std)) stdio[i] = fromWebReadableStream(std.stream());
            else if (std instanceof ReadableStream) stdio[i] = fromWebReadableStream(std);
            else if (std instanceof Response || std instanceof Request) stdio[i] = fromWebReadableStream(std.body!);
            else stdio[i] = std;
        }
        let input: ArrayBufferView | string | undefined;
        if (opts.stdio[0] && typeof opts.stdio[0] !== 'string') {
            stdio[0] = null; // will be overriden by chp.spawnSync "input" option
            //! Due to the fully async nature of Blobs, Responses and Requests,
            //! we can't synchronously get the data out of them here in userland.
            if (opts.stdio[0] instanceof Blob) throw new NotImplementedError('Bun.spawnSync({ stdin: <Blob> })', bun.spawnSync);
            else if (opts.stdio[0] instanceof Response || opts.stdio[0] instanceof Request) throw new NotImplementedError('Bun.spawnSync({ stdin: <Response|Request> })', bun.spawnSync);
            else if (typeof opts.stdio[0] === 'number') input = fs.readFileSync(opts.stdio[0]);
            else input = opts.stdio[0] as ArrayBufferView;
        }

        const subp = chp.spawnSync(cmd, argv, {
            cwd: opts.cwd ?? process.cwd(),
            env: { ...(opts.env as Record<string, string> ?? process.env) },
            stdio, input
        }) as unknown as SyncSubprocess;
        const subpAsNode = subp as unknown as SpawnSyncReturns<Buffer>;
        if (subpAsNode.error) throw subpAsNode.error;

        subp.exitCode = subpAsNode.status ?? NaN; //! not sure what Bun would return here (child killed by signal)
        subp.success = subp.exitCode === 0;
        return subp;
    };
    bun.escapeHTML = (input) => {
        const str = String(input);
        let out = '';
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            switch (char) {
                case '"': out += '&quot;'; break;
                case "'": out += '&#x27;'; break;
                case '&': out += '&amp;'; break;
                case '<': out += '&lt;'; break;
                case '>': out += '&gt;'; break;
                default: out += char;
            }
        }
        return out;
    };
    bun.readableStreamToArrayBuffer = (stream: ReadableStream<ArrayBufferView | ArrayBufferLike>): ArrayBuffer | Promise<ArrayBuffer> => {
        return (async () => {
            const sink = new ArrayBufferSink();
            const reader = stream.getReader();
            while (true) { // eslint-disable-line no-constant-condition
                const { done, value } = await reader.read();
                if (done) break;
                sink.write(value);
            }
            return sink.end() as ArrayBuffer;
        })();
    };
    bun.readableStreamToText = async (stream: ReadableStream<ArrayBufferView | ArrayBufferLike>) => {
        let result = '';
        // @ts-expect-error Typings conflict
        const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
        while (true) { // eslint-disable-line no-constant-condition
            const { done, value } = await reader.read();
            //! for some reason "done" isnt being set to true so this is just infinitely looping at the moment... sigh
            if (done || !value || !value?.length) break;
            result += value;
        }
        return result;
    };
    bun.readableStreamToBlob = async (stream: ReadableStream<any>) => {
        const parts = await bun.readableStreamToArray(stream);
        return new Blob(parts as BlobPart[]);
    };
    bun.readableStreamToArray = async <T = unknown>(stream: ReadableStream<Uint8Array>) => {
        const array = new Array<T>();
        const reader = stream.getReader();
        while (true) { // eslint-disable-line no-constant-condition
            const { done, value } = await reader.read();
            if (done || !value || !value?.length) break;
            array.push(value as unknown as T);
        }
        return array;
    };
    bun.readableStreamToJSON = async <T = unknown>(stream: ReadableStream<Uint8Array>) => {
        const text = await bun.readableStreamToText(stream);
        try {
            return JSON.parse(text) as T;
        } catch (err) {
            Error.captureStackTrace(err as Error, bun.readableStreamToJSON);
            throw err;
        }
    };
    bun.concatArrayBuffers = (buffers) => {
        let size = 0;
        for (const chunk of buffers) size += chunk.byteLength;
        const buffer = new ArrayBuffer(size);
        const view = new Uint8Array(buffer);
        let offset = 0;
        for (const chunk of buffers) {
            view.set(new Uint8Array(chunk instanceof ArrayBuffer || chunk instanceof SharedArrayBuffer ? chunk : chunk.buffer), offset);
            offset += chunk.byteLength;
        }
        return buffer;
    };
    bun.ArrayBufferSink = ArrayBufferSink;
    bun.pathToFileURL = pathToFileURL;
    bun.fileURLToPath = fileURLToPath;
    bun.dns = dns;
    // bun.stringHashCode (undocumented)
    //! It may be possible to implement this with Node ESM loaders, but it would take some effort and have some caveats.
    //! For now, we'll simply make all calls to Bun.plugin no-op, such that manual implementation of an external ESM loader is possible,
    //! but without needing to strip out all Bun.plugin calls from the source code for running on Node.
    const bunPlugin = () => void 0;
    bunPlugin.clearAll = () => void 0;
    bun.plugin = bunPlugin;
    /*void bun.plugin({
        name: 'test',
        target: 'bun',
        setup(builder) {
            if (builder.target !== 'bun') return;
            builder.onResolve({ namespace: 'sample', filter: /.+/ }, args => {
                args.importer;
                if (args.path === 'foo') return { namespace: 'redirect', path: 'bar' };
                else return;
            });
            builder.onLoad({ namespace: 'sample', filter: /.+/ }, args => {
                args.path;
                return { loader: 'object', exports: { foo: 'bar' }, contents: 'void 0;' };
            });
        }
    });*/

    // Misc polyfills
    Math.random = random; //? For jsc.<get/set>RandomSeed

    //! SharedArrayBuffer types being a nuisance, I question if they're even correct
    // @ts-expect-error read above
    if (!globalThis.crypto) globalThis.crypto = cryptoPolyfill; // Don't polyfill if --experimental-global-webcrypto is enabled (or Node 19+)

    if (Bun.enableANSIColors) {
        const RED = '\x1B[31m' as const;
        const RESET = '\x1B[0m' as const;
        const consoleError = console.error;
        console.error = (...args) => {
            if (typeof args[0] === 'string') args[0] = RED + args[0];
            consoleError(...args, RESET);
        };
    }
    //declare global {
    //    interface Console {
    //        [Symbol.asyncIterator](): AsyncIterableIterator<string>;
    //    }
    //}
    //? Implements: for await (const line of console) { ... }
    console[Symbol.asyncIterator] = async function* () {
        while (true) yield await new Promise(resolve => {
            process.stdin.on('data', (data: Buffer | string) => {
                const str = data.toString('utf-8').replaceAll(/[\r\n]+/g, '');
                resolve(str);
            });
        });
    };

    console.write = (...data) => {
        const str = data.map(val => {
            if (val instanceof ArrayBuffer) val = new TextDecoder('utf-8').decode(val);
            else if (typeof val === 'object') val = new TextDecoder('utf-8').decode(val.buffer);
            return val;
        }).join('');
        process.stdout.write(str);
        return new TextEncoder('utf-8').encode(str).byteLength;
    };

    // Doesn't work on Windows sadly
    //Object.defineProperty(process, 'execPath', { value: path.resolve(root, 'cli.js') });

    //? NodeJS Blob doesn't implement Blob.json(), so we need to polyfill it.
    Blob.prototype.json = async function json(this: Blob) {
        try {
            return JSON.parse(await this.text()) as unknown;
        } catch (err) {
            Error.captureStackTrace(err as Error, json);
            throw err;
        }
    };

    Reflect.set(globalThis, 'navigator', {
        userAgent: `Bun/${Bun.version}`,
        hardwareConcurrency: os.cpus().length,
    });

    // internal utils
    /* eslint-disable no-inner-declarations */
    function isOptions(options: any): options is SpawnOptions.OptionsObject {
        return options !== null && typeof options === 'object';
    }

    function isFileBlob(blob: any): blob is BunFileBlob {
        return blob instanceof Blob && Reflect.get(blob, 'readable') instanceof ReadableStream && typeof Reflect.get(blob, 'writer') === 'function';
    }
    /* eslint-enable no-inner-declarations */
}
