import { NotImplementedError } from './utils.js';
//import fs from 'fs';
//type mmapio = typeof import('@raygun-nickj/mmap-io');
//type MapProtectionFlags = Parameters<mmapio['default']['map']>[1];

// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let mmap: /*mmapio['default'] |*/ null = null;
try {
    //mmap = (await import('@raygun-nickj/mmap-io')).default;
    // TODO: the mmap-io module is not working on Node.js 19+, an alternative is needed
    throw void 0;
} catch {
    //(process as unknown as NodeJS.Process).emitWarning('Failed to load mmap-io module, Bun.mmap will not be available.', {
    //    type: 'NodeBunWarning',
    //    code: 'NODEBUN_MMAP_LOAD_FAILED',
    //});
}

export const mmaper: typeof Bun.mmap = (path, opts = {}): Uint8Array => {
    if (!mmap) {
        const err = new Error('Bun.mmap is not available due to missing mmap-io module.');
        Error.captureStackTrace(err, mmaper);
        throw err;
    }
    if (typeof opts.shared === 'undefined') opts.shared = true;
    if (typeof opts.sync === 'undefined') opts.sync = false;
    if (opts.sync) throw new NotImplementedError('Bun.mmap(..., { sync: true })', mmaper);

    //const fd = fs.openSync(path as fs.PathLike, 'r+');
    //const size = fs.fstatSync(fd).size;
    //return mmap.map(size, <MapProtectionFlags>(mmap.PROT_READ | mmap.PROT_WRITE), opts.shared ? mmap.MAP_SHARED : mmap.MAP_PRIVATE, fd);
    return new Uint8Array; // temp
};
