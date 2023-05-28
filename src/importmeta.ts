import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { Mutable } from './utils.js';

export default function(metaIn: ImportMeta) {
    const require = createRequire(metaIn.url);
    const meta = metaIn as Mutable<ImportMeta>;

    meta.path = fileURLToPath(meta.url);
    meta.dir = path.dirname(meta.path);
    meta.file = path.basename(meta.path);
    meta.require = require;
    // eslint-disable-next-line @typescript-eslint/require-await
    meta.resolve = async (id: string, parent?: string) => meta.resolveSync(id, parent);
    meta.resolveSync = (id: string, parent?: string) => require.resolve(id, {
        paths: typeof parent === 'string' ? [path.resolve(parent.startsWith('file://') ? fileURLToPath(parent) : parent, '..')] : undefined,
    });
}
