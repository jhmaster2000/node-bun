// TODO: Figure out what the number Bun is returning is
export default globalThis.gc ? (() => (gc!(), 0)) : (() => {
    const err = new Error('[node-bun] Garbage collection polyfills are only available when Node.js is ran with the --expose-gc flag.');
    Error.captureStackTrace(err, Bun.gc);
    throw err;
    return NaN;
});
