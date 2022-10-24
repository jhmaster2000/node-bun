import streams from 'stream';

export type AnyFunction = (...args: any[]) => any;
export type AnyClass = new (...args: any[]) => any;
export type AnyCallable = AnyFunction | AnyClass;
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export type MapKeysType<T extends Map<unknown, unknown>> = T extends Map<infer K, infer V> ? K : never;
export type MapValuesType<T extends Map<unknown, unknown>> = T extends Map<infer K, infer V> ? V : never;

export const getter = <T>(obj: T, key: string | symbol, get: () => any, enumerable = false, configurable = true): void => {
    Object.defineProperty(obj, key, { get, configurable, enumerable });
};

export const setter = <T>(obj: T, key: string | symbol, set: () => any, enumerable = false, configurable = true): void => {
    Object.defineProperty(obj, key, { set, configurable, enumerable });
};

export const readonly = <T>(obj: T, key: string | symbol, value: unknown, enumerable = false, configurable = true): void => {
    Object.defineProperty(obj, key, { value, configurable, enumerable });
};

export class NotImplementedError extends Error {
    constructor(thing: string, func: AnyCallable = NotImplementedError, overrideMsg: boolean = false) {
        super(overrideMsg ? thing : `A polyfill for ${thing} is not yet implemented by node-bun.`);
        this.name = 'NotImplementedError';
        Error.captureStackTrace(this, func);
    }
}

// eslint-disable-next-line unicorn/custom-error-definition
export class SegmentationFault extends Error {
    constructor() {
        super(
            'You have invoked behavior which causes current versions of Bun to segfault.\n' +
            'It is not possible to accurately know the intended behavior of this code if it didn\'t segfault, so it is not possible to polyfill it yet.\n' +
            'Please report this issue to the Bun team if you wish to see it fixed: https://bun.sh/discord\n\n' +
            'NOTE: This is not a real segfault.'
        );
        this.name = 'SegmentationFault';
    }
}

export function streamToBuffer(stream: streams.Readable | streams.Duplex | NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffers: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => buffers.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(buffers)));
        stream.on("error", (err: Error) => reject(err));
    });
}

export function isArrayBufferView(value: any): value is ArrayBufferView {
    return value !== null && typeof value === 'object' && 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        value.buffer instanceof ArrayBuffer && typeof value.byteLength === 'number' && typeof value.byteOffset === 'number';
}

export function toWebReadableStream(stream: streams.Readable): ReadableStream {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Readable.toWeb(stream) as ReadableStream;
}

export function fromWebReadableStream(stream: ReadableStream): streams.Readable {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Readable.fromWeb(stream) as streams.Readable;
}

export function toWebWritableStream(stream: streams.Writable): WritableStream {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Writable.toWeb(stream) as WritableStream;
}

export function fromWebWritableStream(stream: WritableStream): streams.Writable {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Writable.fromWeb(stream) as streams.Writable;
}

export function toWebDuplexStream(stream: streams.Duplex):  { readable: ReadableStream, writable: WritableStream } {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Duplex.toWeb(stream) as { readable: ReadableStream, writable: WritableStream };
}

export function fromWebDuplexStream(pair: { readable: ReadableStream, writable: WritableStream }): streams.Duplex {
    // @ts-expect-error toWeb() missing from @types/node
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return streams.Duplex.fromWeb(pair) as streams.Duplex;
}
