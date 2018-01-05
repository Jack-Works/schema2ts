import * as yaml from 'yamljs'
import * as ts from 'typescript'
import { URL } from 'url'
import * as request from 'request'
import { Export, AnyType } from './constants'
import { readFileSync } from 'fs'

// tslint:disable-next-line:quotemark (conflict with prettier)
const ValidCharsInURLSpecButNOTInVarName = "-._~:/?#[]@!&'()*+,;=".split('')

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
        new URL(url)
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
        return Promise.resolve(parseJSONorYAML(readFileSync(url, 'utf-8')))
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
    decorators: ts.Decorator[] = [],
) {
    const JSDoc: ts.Decorator | undefined = JSDocCommet
        ? ts.createDecorator(ts.createIdentifier(`__JSDoc__ /** ${JSDocCommet} */`))
        : undefined
    const tdecorator: ts.Decorator[] = [JSDoc as ts.Decorator, ...decorators].filter(x => x)
    const returnTypePromise = ts.createTypeReferenceNode('Promise', [returnType])
    return ts.createFunctionDeclaration(
        tdecorator,
        [Export, ...modifiers],
        undefined,
        name,
        undefined,
        parameters,
        returnTypePromise,
        body,
    )
}
