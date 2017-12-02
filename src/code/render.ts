import * as ts from 'typescript'
import * as Types from './types'
import { getValidVarName, GenerateAsyncFunction } from '../utils'
import { Server, IEndPoint } from './server'
import { Export, AnyType } from '../constants'

/** Render Typescript Node to string */
const render = (() => {
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false })
	const doc = ts.createSourceFile('', '', ts.ScriptTarget.Latest)
	return (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, doc)
})()

class Transformer {
	declarations: ts.Declaration[] = []
	statements: ts.Statement[] = []
	endPointToDeclaration(ep: IEndPoint) {
		const name = getValidVarName(ep.url + '_' + ep.method).replace(/^_+/, '')
		ep.name = ep.name || name
		function toReference(type: Types.Type | undefined, name: string): Types.TypeReferenceType {
			if (!type) { return new Types.TypeReferenceType(name, new Types.Any) }
			if (Types.isTypeReference(type)) { return type }
			return new Types.TypeReferenceType(name, type)
		}
		const pathParams = toReference(ep.urlParams, name + '_parameter_path')
		const bodyParams = toReference(ep.bodyParams, name + '_parameter_body')
		const queryParams = toReference(ep.queryParams, name + '_parameter_query')
		const headerParams = toReference(ep.headerParams, name + '_parameter_header')
		this.declarations.push(...[pathParams, bodyParams, queryParams, headerParams]
			.reduce<ts.Declaration[]>((decs, curr) => {
				decs.push(...curr.getDeclaration())
				return decs
			}, []))

		const parameters = [
			{ key: 'path', type: pathParams },
			{ key: 'query', type: queryParams },
			{ key: 'headers', type: headerParams },
			{ key: 'body', type: bodyParams }
		]
		/** Create function below */
		const url = ts.createVariableStatement([Export], [ts.createVariableDeclaration(name + '_url', undefined, ts.createLiteral(ep.url))])
		const method = ts.createVariableStatement([Export], [ts.createVariableDeclaration(name + '_method', undefined, ts.createLiteral(ep.method))])
		this.statements.push(url, method)
		const id = (x: string) => ts.createIdentifier(x)
		const notEmitParameters = parameters.filter(x => x.type.isFalsy()).map(x => x.key)
		const FunctionBody: ts.FunctionBody = ts.createBlock([
			ts.createReturn(
				// _.request(...)
				ts.createCall(id('_.request'), undefined, [
					// name_url, name_method, { query, body, path, headers, bodyType}
					id(name + '_url'),
					id(name + '_method'),
					ts.createObjectLiteral([
						ts.createPropertyAssignment('query', id('query')),
						ts.createPropertyAssignment('body', id('body')),
						ts.createPropertyAssignment('path', id('path')),
						ts.createPropertyAssignment('headers', id('headers')),
						ts.createPropertyAssignment('bodyType', ts.createLiteral(ep.bodyParamsType)),
					].filter(x => -1 === notEmitParameters.indexOf((x.name as ts.Identifier).escapedText.toString())))
				])
			)
		], true)
		function createResponse(statusCode: ts.TypeNode, ref: ts.TypeNode) {
			return ts.createTypeReferenceNode('_Response', [statusCode, ref])
		}
		const returnTypesUnion: ts.TypeNode = (result => {
			type Response = [number, ts.TypeNode]
			if (!ep.result) { return AnyType }
			const refs = ep.result.map<Response>(([code, type]) => {
				if (type.isFalsy()) return null as any
				if (Types.isLiteralType(type)) {
					return [code, type.toTypescript()]
				}
				const ref = new Types.TypeReferenceType(name + '_result_' + code, type)
				this.declarations.push(...ref.getDeclaration())
				return [code, type.toTypescript()]
			}).filter((x: any) => x)
			if (refs.length === 0) { return createResponse(AnyType, AnyType) }
			if (refs.length === 1) { return createResponse(new Types.Literal(refs[0][0], true).toTypescript(), refs[0][1]) }
			return ts.createUnionTypeNode(
				refs.map((x: Response) => createResponse(
					new Types.Literal(x[0], true).toTypescript(), x[1]
				)))
		})(ep.result)

		this.declarations.push(GenerateAsyncFunction(
			name + '_invoke',
			FunctionBody,
			parameters
				.filter(x => !x.type.isFalsy())
				.map(x => ts.createParameter(undefined, undefined, undefined, x.key, undefined, x.type.toTypescript())),
			returnTypesUnion,
			ep.comment
		))
		this.removeDuplicateDeclarations()
	}
	removeDuplicateDeclarations() {
		const names: string[] = []
		this.declarations = this.declarations.filter(dec => {
			const name = (ts.getNameOfDeclaration(dec) as ts.Identifier).escapedText.toString()
			if (names.indexOf(name) !== -1) return false
			names.push(name)
			return true
		})
	}
}

/** Inject vars */
function vars(str: string): string {
	const now = new Date
	const packageJson = require('../../package.json')
	return str.
		replace(/%version%/g, packageJson.version).
		replace(/%when%/g, now.toLocaleDateString() + ' ' + now.toLocaleTimeString()).
		replace(/%typescript-version%/g, packageJson.dependencies ? packageJson.dependencies.typescript : 'unknown')
}
export function Generator(server: Server, template: string) {
	const transformer = new Transformer
	server.endpoints.map(x => transformer.endPointToDeclaration(x))
	// Read data
	const statements = transformer.statements.map(render).join('\n')
	const declarations = transformer.declarations.map(render).join('\n')
	const result = template += '\n' + statements + '\n' + declarations
	const code = render(ts.createSourceFile('generated.ts', result, ts.ScriptTarget.Latest, false)).
		replace(/@__JSDoc__ /g, '')
	return vars(code)
}
