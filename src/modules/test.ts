import * as mocha from 'mocha';
import { expect as _expect } from 'expect';

export const describe = globalThis.describe ?? mocha.describe;
export const it = globalThis.it ?? mocha.it;
export const test = globalThis.it ?? mocha.it;

export const expect = _expect;

export default { describe, it, test, expect };
