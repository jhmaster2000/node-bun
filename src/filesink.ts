import type { FileSink as BunFileSink } from 'bun';
import { SystemError } from './systemerror.js';
import fs from 'fs';

export class FileSink implements BunFileSink {
    constructor(fdOrPath: number | string) {
        if (typeof fdOrPath === 'string') try {
            this.#fd = fs.openSync(fdOrPath, 'a+');
            fs.ftruncateSync(this.#fd, 0);
        } catch (err) {
            throw err as SystemError;
        }
        else {
            this.#fd = fdOrPath; // hope this fd is writable
            fs.ftruncateSync(this.#fd, 0);
        }
    }
    #fd: number = NaN;
    #closed: boolean = false;
    #writtenSinceFlush: number = 0;
    #totalWritten: number = 0;

    start(options?: { highWaterMark?: number | undefined; } | undefined): void {
        return; // TODO
    }

    ref(): void {
        return; // TODO
    }

    unref(): void {
        return; // TODO
    }

    write(chunk: string | ArrayBufferView | SharedArrayBuffer | ArrayBuffer): number {
        if (this.#closed) {
            return typeof chunk === 'string' ? chunk.length : chunk.byteLength;
        }
        if (typeof chunk === 'string') {
            fs.appendFileSync(this.#fd, chunk, 'utf8');
            this.#writtenSinceFlush += chunk.length;
            return chunk.length;
        }
        if (chunk instanceof ArrayBuffer || chunk instanceof SharedArrayBuffer) fs.appendFileSync(this.#fd, new Uint8Array(chunk));
        else fs.appendFileSync(this.#fd, new Uint8Array(chunk.buffer));
        this.#writtenSinceFlush += chunk.byteLength;
        return chunk.byteLength;
    }

    //! flushing after writing to a closed FileSink segfaults in Bun but I don't see the need to implement that behavior
    flush(): number | Promise<number> {
        if (this.#closed) return 0;
        // no-op because this is a synchronous implementation
        const written = this.#writtenSinceFlush;
        this.#writtenSinceFlush = 0;
        return written;
    }

    //! not sure what to do with this error
    end(error?: Error): number | Promise<number> {
        if (this.#closed) return this.#totalWritten;
        const flushed = this.flush();
        this.#totalWritten = fs.fstatSync(this.#fd).size;
        fs.closeSync(this.#fd);
        this.#closed = true;
        return flushed;
    }
}