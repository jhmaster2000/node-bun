import swc from '@swc/core';
import swcrc from './swcrc.js';
import type { JavaScriptLoader } from 'bun';

export default class Transpiler extends swc.Compiler {
    constructor(options?: import('bun').TranspilerOptions) {
        super();
        this.#options = options ?? {};
        if (this.#options.loader) this.#syntax = this.#options.loader.startsWith('ts') ? 'typescript' : 'ecmascript';
    }

    // @ts-expect-error Force override
    override async transform(code: StringOrBuffer, loader: JavaScriptLoader): Promise<string> {
        if (typeof code !== 'string') code = new TextDecoder().decode(code);
        swcrc.jsc!.parser!.syntax = loader.startsWith('ts') ? 'typescript' : 'ecmascript';
        return (await super.transform(code, swcrc)).code || ';';
    }

    // @ts-expect-error Force override
    override transformSync(code: StringOrBuffer, _ctx: object): string
    // @ts-expect-error Force override
    override transformSync(code: StringOrBuffer, loader?: JavaScriptLoader): string
    // @ts-expect-error Force override
    override transformSync(code: StringOrBuffer, loader: JavaScriptLoader, _ctx: object): string
    // @ts-expect-error Force override
    override transformSync(code: StringOrBuffer, loaderOrCtx?: JavaScriptLoader | object, _ctx?: object): string {
        if (typeof code !== 'string') code = new TextDecoder().decode(code);
        if (typeof loaderOrCtx !== 'string') loaderOrCtx = 'js'; // TODO: Support the ctx arg, what even is it supposed to be?
        swcrc.jsc!.parser!.syntax = loaderOrCtx.startsWith('ts') ? 'typescript' : 'ecmascript';
        return super.transformSync(code, swcrc).code || ';';
    }

    scan(code: StringOrBuffer) {
        if (typeof code !== 'string') code = new TextDecoder().decode(code);
        return {
            imports: this.scanImports(code),
            exports: this.#scanExports(code)
        };
    }

    scanImports(code: StringOrBuffer) {
        if (typeof code !== 'string') code = new TextDecoder().decode(code);
        const imports: { kind: 'import-statement' | 'dynamic-import', path: string }[] = [];
        this.#scanTopLevelImports(code).forEach(x => imports.push({ kind: 'import-statement', path: x }));
        this.#scanDynamicImports(code).forEach(x => imports.push({ kind: 'dynamic-import', path: x }));
        return imports;
    }

    #scanDynamicImports(code: string): string[] {
        return this.parseSync(code, {
            syntax: this.#syntax, target: 'es2022', tsx: this.#options.loader === 'tsx'
        }).body.filter(x => x.type === 'ExpressionStatement' && x.expression.type === 'CallExpression' && x.expression.callee.type === 'Import')
            .map(i => (((i as swc.ExpressionStatement).expression as swc.CallExpression).arguments[0].expression as swc.StringLiteral).value);
    }

    #scanTopLevelImports(code: string): string[] {
        return this.parseSync(code, {
            syntax: this.#syntax, target: 'es2022', tsx: this.#options.loader === 'tsx'
        }).body.filter(x => x.type === 'ImportDeclaration' || x.type === 'ExportAllDeclaration' || x.type === 'ExportNamedDeclaration')
            .filter(i => !(i as swc.ImportDeclaration).typeOnly)
            .map(i => (i as swc.ImportDeclaration).source.value);
    }

    #scanExports(code: string, includeDefault: boolean = false): string[] {
        const parsed = this.parseSync(code, {
            syntax: this.#syntax, target: 'es2022', tsx: this.#options.loader === 'tsx'
        }).body;
        const exports = [];
        exports.push(parsed.filter(x => x.type === 'ExportDeclaration' && !x.declaration.declare)
            .flatMap(i => ((i as swc.ExportDeclaration).declaration as swc.ClassDeclaration).identifier?.value ??
                ((i as swc.ExportDeclaration).declaration as swc.VariableDeclaration).declarations.map(d => (d.id as swc.Identifier).value)
            )
        );
        exports.push(parsed.filter(x => x.type === 'ExportNamedDeclaration')
            .flatMap(i => (i as swc.ExportNamedDeclaration).specifiers
                .filter(s => s.type === 'ExportSpecifier' && !s.isTypeOnly)
                .map(s => (s as swc.NamedExportSpecifier).exported?.value ?? (s as swc.NamedExportSpecifier).orig.value)
            )
        );
        if (includeDefault) exports.push(this.#scanDefaultExport(code) ?? []);
        return exports.flat();
    }

    #scanDefaultExport(code: string): 'default' | undefined {
        const parsed = this.parseSync(code, {
            syntax: this.#syntax, target: 'es2022', tsx: this.#options.loader === 'tsx'
        }).body;
        
        const defaultExportDecl = parsed.find(x => x.type === 'ExportDefaultDeclaration') as swc.ExportDefaultDeclaration | undefined;
        if (!defaultExportDecl) {
            const defaultExportExpr = parsed.find(x => x.type === 'ExportDefaultExpression') as swc.ExportDefaultExpression | undefined;
            if (!defaultExportExpr) return undefined;
            if (!defaultExportExpr.expression.type.startsWith('Ts')) return 'default';
            else return undefined;
        }

        if (!defaultExportDecl.decl.type.startsWith('Ts') && !Reflect.get(defaultExportDecl.decl, 'declare')) return 'default';
        else return undefined;
    }

    #syntax: 'typescript' | 'ecmascript' = 'ecmascript';
    #options: import('bun').TranspilerOptions;
}
