import * as ts from 'typescript'
import { ReadonlyFileSystemHost } from '../utils'
import * as packageJson from '../../package.json'
import * as ast from 'ts-simple-ast'

export class Render extends ast.default {
    constructor(private config: { declarationOnly?: boolean } = {}) {
        super(
            {
                compilerOptions: {
                    declaration: config.declarationOnly,
                    target: ts.ScriptTarget.Latest,
                    module: ts.ModuleKind.ESNext,
                    moduleResolution: ts.ModuleResolutionKind.NodeJs,
                },
                manipulationSettings: {
                    quoteType: ast.QuoteType.Single,
                },
            },
            new ReadonlyFileSystemHost(),
        )
    }
    schema2tsEmit(which: string) {
        const sourcefile = this.getSourceFile(which)
        if (!sourcefile) {
            throw new Error('File not found when emitting.')
        }
        const dts = sourcefile.emit({ emitOnlyDtsFiles: this.config.declarationOnly })
        dts.getDiagnostics().forEach(diag => console.warn(`TS${diag.getCode()}: ${diag.getMessageText()}`))
        if (dts.getEmitSkipped()) {
            throw new Error('Typescript skipped emit file.')
        }
        let path = sourcefile.getFilePath()
        if (this.config.declarationOnly) {
            path = path.replace(/\.ts$/, '.d.ts')
        }
        return this.getFileSystem().readFileSync(path, 'utf-8')
    }
    static nodeToString = (() => {
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false })
        const doc = ts.createSourceFile('', '', ts.ScriptTarget.Latest)
        return (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, doc)
    })()
    static injectTemplateVariables(str: string): string {
        const now = new Date()
        return str
            .replace(/%version%/g, packageJson.version)
            .replace(/%when%/g, now.toLocaleDateString() + ' ' + now.toLocaleTimeString())
            .replace(
                /%typescript-version%/g,
                packageJson.dependencies ? packageJson.dependencies.typescript : 'unknown',
            )
    }
}
