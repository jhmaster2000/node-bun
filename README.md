# node-bun
Node.js Compatibility Layer & Polyfills for Bun APIs

> **Highly experimental and unfinished**

## Goals
- Provide the ability to run programs and libraries written only for Bun in Node.js, for dual runtime support
- Remove the need for developers themselves to implement conditional feature usage based on runtime to support both Node.js and Bun
- Be functionality matching but not necessarily 1:1 identical, there will be quirks in some cases
- Implement beyond just the `Bun` global object, Bun specific properties added to the global object or `process` are included
- Implement Bun's built-in modules such as `bun:jsc` or `bun:ffi`
- Running TypeScript support & with Bun module resolution rules

## Explicit Non-goals
- Replace Bun (Bun does much more than just runtime APIs + the many other reasons below)
- Match native Bun performance (simply not possible)
- Help run Node.js apps in Bun (Bun itself is already working on this, `node-bun` is only providing the other way around)
- Support Bun features beyond the runtime, such as CLI features like `--hot` (out of scope)
- Runtime features only accessible through Bun CLI, such as bun:test (out of scope)
- Implement Bun APIs not documented in `bun-types` (all assumed internal or unfinished thus not worthy of polyfill)
- Full CommonJS <-> ESM interop (some polyfills are simply not possible in CommonJS, so this is ESM only)
- Follow these lists literally, there may be occasional exceptions or changes towards both sides

## Requirements
- Node.js 20.2+

## Installation
```sh
npm i -g node-bun
```

## Usage
The CLI is designed to act as a drop-in replacement to any Node.js command, by simply replacing `node` with `node-bun`
```sh
node-bun # display help
node-bun ./file.ts # same as `node ./file.js`
node-bun --info # node-bun specific flag will be passed to node-bun and not seen by Node.js
node-bun -v # valid Node.js flag will be passed to Node.js and not seen by node-bun
```

## Versioning
`node-bun`'s version will always try to match the closest Bun version that polyfills are supported for, if a new `node-bun` release is needed for the same Bun version, it will use a semver tag called `rev` (revision) as a fourth version number.

Example: `0.2.0` -> `0.2.1` -> `0.2.1-rev.1` -> `0.2.1-rev.2` -> `0.2.2` -> `...`

The `Bun.version` and `process.versions.bun` properties are set to the `node-bun` version but with the `rev` tag stripped out.

Use `process.versions.nodebun` to get the unstripped version of `node-bun` that is running.

## `node-bun` specific APIs

- `process.versions.nodebun`: {**string**} the version of `node-bun` in use
- `process.isNodeBun`: {**1 | undefined**} whether `node-bun` is in use or not, this is a number for parity with `process.isBun`
