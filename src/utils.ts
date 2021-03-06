import * as yaml from 'yamljs'
import * as ts from 'typescript'
import { URL } from 'url'
import * as request from 'request'
import { Export, AnyType } from './constants'
import { readFileSync } from 'fs'
import { join, normalize } from 'path'
import { DefaultFileSystemHost } from 'ts-simple-ast/dist/fileSystem'
import { Schema } from 'swagger-schema-official'
import * as Types from './code/types'
import * as $RefParser from 'json-schema-ref-parser'
import { JSDoc } from './code/server'

// tslint:disable-next-line:quotemark (conflict with prettier)
const ValidCharsInURLSpecButNOTInVarName = "-._~:/?#[]@!&'()*+,;= ".split('')
/**
 * A FileSystemHost provided to typescript compiler
 */
export class ReadonlyFileSystemHost extends DefaultFileSystemHost {
    public changes = new Map<string, string>()
    getPath(filePath: string) {
        return normalize(join(this.getCurrentDirectory(), filePath))
    }
    async writeFile(filePath: string, fileText: string) {
        this.changes.set(this.getPath(filePath), fileText)
    }
    writeFileSync(filePath: string, fileText: string) {
        this.changes.set(this.getPath(filePath), fileText)
    }
    readFileSync(filePath: string, encoding?: string) {
        return this.changes.get(this.getPath(filePath)) || super.readFileSync(filePath, encoding)
    }
    async readFile(filePath: string, encoding?: string) {
        const f = this.changes.get(this.getPath(filePath))
        return f ? Promise.resolve(f) : super.readFile(filePath, encoding)
    }
}
/** Get a valid variable name from url string */
export function getValidVarName(name: string) {
    return name
        .split('')
        .map(char => (ValidCharsInURLSpecButNOTInVarName.indexOf(char) !== -1 ? '_' : char))
        .join('')
        .replace('{', '$')
        .replace('}', '')
}

/** Parse JSON or Yaml */
export function parseJSONorYAML(text: string): any {
    try {
        return JSON.parse(text)
    } catch (jsonerr) {
        try {
            return yaml.parse(text)
        } catch (yamlerr) {
            const jsonmsg = jsonerr.message
            const yamlmsg = yamlerr.message
            throw new SyntaxError(`JSON and Yaml parser failed to parse the input file
  JSON: ${jsonmsg}
  Yaml: ${yamlmsg} at line ${yamlerr.parsedLine || 'unknown'}`)
        }
    }
}
/** Request a file */
export function requestFile(url: string): Promise<string> {
    try {
        const u = new URL(url)
        // This also includes https
        if (!u.protocol.includes('http')) {
            throw new Error('This is a file')
        }
        return new Promise((resolve, reject) => {
            request(url, (error, response, body) => {
                if (error) return reject(error)
                try {
                    return resolve(body)
                } catch (e) {
                    return reject(e)
                }
            })
        })
    } catch {
        return Promise.resolve(readFileSync(url, 'utf-8'))
    }
}

/** Create a Typescript Async function Declaration */
export function GenerateAsyncFunction(
    name: string | ts.Identifier,
    body: ts.FunctionBody,
    parameters: ts.ParameterDeclaration[] = [],
    returnType: ts.TypeNode = AnyType,
    JSDocCommet?: string,
    modifiers: ts.Modifier[] = [],
) {
    const returnTypePromise = ts.createTypeReferenceNode('Promise', [returnType])
    const node = ts.createFunctionDeclaration(
        undefined,
        [Export, ...modifiers],
        undefined,
        name,
        undefined,
        parameters,
        returnTypePromise,
        body,
    )
    JSDocCommet && ts.addSyntheticLeadingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, `* ${JSDocCommet} `, true)
    return node
}

export type JSONSchemaPrimitive = 'array' | 'boolean' | 'integer' | 'float' | 'number' | 'null' | 'object' | 'string'
export type OpenAPI2AdditionalPrimitive = 'long' | 'double'

/** JSON Schema -> Schema2ts inner express */
export async function createJSONSchemaToTypes(document: any, nameOptions?: any) {
    const doc: $RefParser.$Refs = await ($RefParser as any).resolve(document)
    return function JSONSchemaToTypes(from: Schema): Types.Type {
        //#region Speical properties
        if (from.$ref) {
            const result = doc.get(from.$ref)
            const name = getJSONRefName(from, nameOptions)
            try {
                return new Types.TypeReferenceType(name!, JSONSchemaToTypes(result as any))
            } catch {
                return new Types.TypeReferenceType(name!, Types.shape(result))
            }
        } else if (from.allOf) {
            /**
             * allOf, anyOf, oneOf, See this
             * https://tools.ietf.org/html/draft-fge-json-schema-validation-00#section-5.5.3 */
            return new Types.And(from.allOf.map(x => JSONSchemaToTypes(x)))
        } else if ((from as any).anyOf) {
            console.warn(`Typescript can not express JSON 'anyOf' easily, treat as 'oneOf'`)
            const newer = { ...from, oneOf: (from as any).anyOf, anyOf: undefined }
            return JSONSchemaToTypes(newer)
        } else if ((from as any).oneOf) {
            return new Types.Or(((from as any).oneOf as Schema[]).map(x => JSONSchemaToTypes(x)))
        } else if (from.additionalProperties) {
            const newer = { ...from, additionalProperties: undefined }
            return new Types.And([JSONSchemaToTypes(newer), JSONSchemaToTypes(from.additionalProperties)])
        } else if (from.enum) {
            const newer = { ...from, enum: undefined }
            if (from.type === 'string' || from.type === 'number') {
                const enums: string[] = from.enum.filter(x => typeof x === 'string') as any
                let EnumName: string | undefined = undefined
                // Speical case for OpenAPI 2.0
                if (document.definitions) {
                    for (const key in document.definitions) {
                        const _def = document.definitions[key].enum
                        // Check if enum in the definitions is the same as current enum
                        // Cause OpenAPI 2.0 enum use yaml reference, so the name is lost in the convertion
                        // We have to use this way to compare
                        if (
                            _def &&
                            document.definitions[key].type === from.type && // string enum is not equal to number enum
                            Array.isArray(_def) &&
                            _def.every((v, i) => v === from.enum![i]) // Since the enum ref is using yaml ref, it must keep the same order
                        ) {
                            EnumName = key
                        }
                    }
                }
                if (EnumName) {
                    // We get the name of enum
                    return new Types.EnumOf(
                        EnumName,
                        enums.map((x, index) => ({
                            name: x as string,
                            value: from.type === 'string' ? (x as string) : index,
                            // If this is a string enum, then every enum value is the name of itself
                        })),
                    )
                } else {
                    // We can't figure out the name of enum, so we have to use a | b | c type
                    const or = new Types.Or(
                        enums.map((member, index) => new Types.Literal(from.type === 'string' ? member : index, true)),
                    )
                    from.type === 'number' && or.addJSDoc(['enum:', ...enums.map((x, index) => `  ${x}: ${index}`)])
                    return or
                }
            } else {
                console.warn(`Schema2ts can not create **enum** of type **${from.type}**, use it original type instead`)
                return JSONSchemaToTypes(newer)
            }
        }
        //#endregion

        const type: JSONSchemaPrimitive | OpenAPI2AdditionalPrimitive = from && (from.type as any)
        if (isNumber(type)) return new Types.Literal(0, false)
        switch (type) {
            case 'array':
                if (Array.isArray(from.items)) {
                    return new Types.ArrayOf(JSONSchemaToTypes(from.items[0]))
                } else if (!from.items) {
                    return new Types.Any()
                } else {
                    return new Types.ArrayOf(JSONSchemaToTypes(from.items))
                }
            case 'object':
                const props = from.properties!
                const ofWhat: Types.ObjectOfWhat[] = []
                for (const key in props) {
                    const schema = props[key]
                    ofWhat.push({
                        key: key,
                        value: JSONSchemaToTypes(schema),
                        optional: (from.required || []).every(x => x !== key),
                        jsdoc: from.description,
                        readonly: from.readOnly,
                        defaultValue: from.default,
                    })
                }
                return new Types.ObjectOf(ofWhat)
            case 'string':
                return new Types.Literal('', false)
            case 'boolean':
                return new Types.Literal(true, false)
            case 'null':
                return new Types.Any()
            default:
                try {
                    const newer = { ...from, type: 'object' }
                    return JSONSchemaToTypes(newer)
                } catch {
                    return JSONSchemaToTypes({ type: 'null' })
                }
        }
    }
}
function isNumber(n?: string) {
    switch (n) {
        case 'integer':
        case 'long':
        case 'float':
        case 'double':
        case 'number':
            return true
        default:
            return false
    }
}

export const getJSONRefName = (x: Schema, openapi?: any) => {
    // For valid name, see https://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-04#section-3
    let name = x.$ref
    if (typeof name !== 'string') return undefined
    if (name === '#') {
        return 'Document'
    }
    if (name.startsWith('#')) name = name.replace(/^#/, '')
    if (name === '/') return 'Document'
    if (name.startsWith('/')) name = name.replace(/^\//, '')
    if (openapi) {
        if (name.startsWith('definitions')) return getValidVarName(name).replace(/^definitions_/, '')
    }
    return getValidVarName(name)
}

export function createJSDoc(jsdoc?: JSDoc) {
    if (!jsdoc || Object.keys(jsdoc).filter(x => (jsdoc as any)[x] !== undefined).length === 0) {
        return
    }
    let comment = ''
    if (jsdoc.depercated) comment += '\n@depercated'
    if (jsdoc.summary) comment += '\n@summary ' + jsdoc.summary
    if (jsdoc.description) comment += '\n@description ' + jsdoc.description
    if (jsdoc.see) comment += '\n@see ' + jsdoc.see
    comment = comment.replace(/^\n/, '')
    if (comment.match(/\n/)) comment += '\n'
    return comment
}
