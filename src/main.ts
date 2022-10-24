/* eslint-disable @typescript-eslint/ban-ts-comment */
//import type { Performance } from 'perf_hooks';
import chp from 'child_process'; chp;
import tty from 'tty'; tty;

// @ts-ignore
//console.log(((Bun.nanoseconds() / 1000000)|0) - ((performance as Performance)?.nodeTiming?.bootstrapComplete|0 || 0), 'ms to load');

// e@ts-expect-error So it doesn't flood the log
//Bun.env = {};
const proc = process as unknown as NodeJS.Process; proc;
//proc.on('uncaughtException', (err) => { void 0; });
const RED = '\x1B[31m' as const; RED;
const RESET = '\x1B[0m' as const; RESET;

console.log(Bun.version);

//const child = Bun.spawnSync({
//    cmd: ["cat"],
//    stdin: new TextEncoder().encode("foo bar"),
//    //stdio: [null, 'inherit', 'inherit'],
//});
//
////console.log(child);
//console.log(child.success);
//console.log(child.exitCode);
//console.log(child.stdout);
//console.log(child.stderr);

//console.dir(Bun, { depth: 0 });
