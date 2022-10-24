import swc from '@swc/core';

const swcrc: swc.Options = {
    inlineSourcesContent: false,
    sourceMaps: 'inline',
    isModule: true,
    minify: true, //! partial workaround for https://github.com/swc-project/swc/issues/5628
    swcrc: false,
    module: {
        type: 'nodenext',
        lazy: false,
        strict: true,
        strictMode: false,
        ignoreDynamic: true,
        importInterop: 'none',
    },
    jsc: {
        target: 'es2022',
        parser: {
            syntax: 'typescript',
            dynamicImport: true,
            decorators: false,
        },
        transform: {
            useDefineForClassFields: false,
            treatConstEnumAsEnum: false,
            optimizer: {
                simplify: true,
                globals: { vars: {} }
            }
        },
        preserveAllComments: false,
        keepClassNames: true,
        loose: false,
    }
};

export default swcrc;
