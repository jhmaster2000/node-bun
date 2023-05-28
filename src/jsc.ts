import { setRandomSeed, getRandomSeed } from './mathrandom.js';
import { NotImplementedError } from './utils.js';
import type jsc from 'bun:jsc';
import v8 from 'v8';
import nodegc from './gc.js';

const NO_STACK = () => { void 0; };

const proc = process as unknown as NodeJS.Process;

const v8jsc: typeof jsc = {
    setTimeZone() { throw new NotImplementedError('jsc.setTimeZone', NO_STACK); }, // no, simply setting TZ is not enough
    profile() { throw new NotImplementedError('jsc.profile', NO_STACK); },
    startSamplingProfiler() { throw new NotImplementedError('jsc.startSamplingProfiler', NO_STACK); },
    callerSourceOrigin() { throw new NotImplementedError('jsc.callerSourceOrigin', NO_STACK); },
    jscDescribe() { throw new NotImplementedError('jsc.jscDescribe', NO_STACK); },
    jscDescribeArray() { throw new NotImplementedError('jsc.jscDescribeArray', NO_STACK); },
    drainMicrotasks() { void 0; }, //! possibly broken
    edenGC: nodegc,
    fullGC: nodegc,
    gcAndSweep: nodegc,
    getProtectedObjects() { return [globalThis]; }, //! this is a really poor polyfill but it's better than nothing
    getRandomSeed,
    heapSize() { return v8.getHeapStatistics().used_heap_size; },
    heapStats() {
        const stats = v8.getHeapStatistics();
        return {
            heapSize: stats.used_heap_size,
            heapCapacity: stats.total_available_size,
            extraMemorySize: stats.external_memory ?? 0,
            objectCount: 1, //! likely broken, seems to always return 0
            protectedObjectCount: v8jsc.getProtectedObjects().length,
            globalObjectCount: 4, //! likely broken, seems to always return 4
            protectedGlobalObjectCount: 1, //! likely broken, seems to always return 1
            objectTypeCounts: {}, //! can't really throw an error here, so just return an empty object
            protectedObjectTypeCounts: {} //! can't really throw an error here, so just return an empty object
        };
    },
    isRope() { return false; }, //! doubtful anyone relies on the return of this for anything besides debugging
    memoryUsage() {
        const stats = v8.getHeapStatistics();
        const resuse = proc.resourceUsage();
        return {
            current: stats.malloced_memory,
            peak: stats.peak_malloced_memory,
            currentCommit: stats.malloced_memory,
            peakCommit: stats.malloced_memory,
            pageFaults: resuse.minorPageFault + resuse.majorPageFault
        };
    },
    // eslint-disable-next-line @typescript-eslint/ban-types
    noFTL() { return void 0 as unknown as Function; }, //! likely broken, always returns undefined
    // eslint-disable-next-line @typescript-eslint/ban-types
    noOSRExitFuzzing() { return void 0 as unknown as Function; }, //! likely broken, always returns undefined
    numberOfDFGCompiles() { return 1; }, //! likely broken, always returns 0
    optimizeNextInvocation() { throw new NotImplementedError('jsc.optimizeNextInvocation', NO_STACK); }, //! impossible to polyfill
    releaseWeakRefs() { void 0; }, //! possibly broken
    reoptimizationRetryCount(...args) {
        //! likely broken, always returns 0 as long as any arguments are passed
        return args.length ? 0 : void 0 as unknown as number;
    },
    setRandomSeed,
    startRemoteDebugger() { void 0; }, //! likely broken
    totalCompileTime() { return 0; } //! likely broken
};

export default v8jsc;
