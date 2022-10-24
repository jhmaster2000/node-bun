export default globalThis.gc ? gc : () => {
    const err = new Error('[node-bun] Garbage collection polyfills are only available when Node.js is ran with the --expose-gc flag.');
    Error.captureStackTrace(err, Bun.gc);
    throw err;
};
