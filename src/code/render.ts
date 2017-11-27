import * as ts from 'typescript'
import * as Types from './types'
import { Export, getValidVarName } from '../utils'
import { Server, IEndPoint } from './server'

//#region Render
/** Printer that used by render  */
const [printer, doc] = [
	ts.createPrinter({
		newLine: ts.NewLineKind.LineFeed, removeComments: false
	}),
	ts.createSourceFile('', '', ts.ScriptTarget.Latest)]

/** Typescript.Node -> string */
function render(node: ts.Node): string {
	return printer.printNode(
		ts.EmitHint.Unspecified,
		node,
		doc
	)
}
//#endregion

/** Create a Typescript Async function Declaration */
function GenerateAsyncFunction(
	name: string | ts.Identifier,
	body: ts.FunctionBody,
	parameters: ts.ParameterDeclaration[] = [],
	returnType: ts.TypeNode = (new Types.Any).toTypescript(),
	JSDocCommet?: string,
	modifiers: ts.Modifier[] = [],
	decorators: ts.Decorator[] = []) {
	const JSDoc: ts.Decorator = JSDocCommet && ts.createDecorator(ts.createIdentifier(`__JSDoc__ /** ${JSDocCommet} */`))
	const tdecorator = [JSDoc, ...decorators]
	const returnTypePromise = ts.createTypeReferenceNode('Promise', [returnType])
	return ts.createFunctionDeclaration(
		tdecorator, [Export, ...modifiers],
		null, name, null, parameters, returnTypePromise, body
	)
}

class Transformer {
	declarations: ts.Declaration[] = []
	statements: ts.Statement[] = []
	endPointToDeclaration(ep: IEndPoint) {
		const name = getValidVarName(ep.url + '_' + ep.method)
		ep.name = ep.name || name
		function toReference(type: Types.Type, name): Types.TypeReferenceType {
			if (Types.is<Types.TypeReferenceType>(type, Types.TypescriptType.TypeReference)) { return type }
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
			{ key: 'data', type: bodyParams },
			{ key: 'headers', type: headerParams },
			{ key: 'body', type: bodyParams }
		]
		/** Create function below */
		const url = ts.createVariableStatement([Export], [ts.createVariableDeclaration(name + '_url', null, ts.createLiteral(ep.url))])
		const method = ts.createVariableStatement([Export], [ts.createVariableDeclaration(name + '_method', null, ts.createLiteral(ep.method))])
		this.statements.push(url, method)
		const id = x => ts.createIdentifier(x)
		const FunctionBody: ts.FunctionBody = ts.createBlock([
			ts.createReturn(
				// _.request(...)
				ts.createCall(id('_.request'), null, [
					// name_url, name_method, { query, body, path, headers, bodyType}
					id(name + '_url'),
					id(name + '_method'),
					ts.createObjectLiteral([
						ts.createPropertyAssignment('query', id('query')),
						ts.createPropertyAssignment('body', id('body')),
						ts.createPropertyAssignment('path', id('path')),
						ts.createPropertyAssignment('headers', id('headers')),
						ts.createPropertyAssignment('bodyType', ts.createLiteral(ep.bodyParamsType)),
					])
				])
			)
		], true)
		function createResponse(statusCode: ts.TypeNode, ref: ts.TypeNode) {
			return ts.createTypeReferenceNode('_Response', [statusCode, ref])
		}
		const Any = (new Types.Any).toTypescript()
		const returnTypesUnion: ts.TypeNode = (result => {
			const refs = ep.result.map<[number, ts.TypeNode]>(([code, type]) => {
				const ref = new Types.TypeReferenceType(name + '_result_' + code, type)
				this.declarations.push(...ref.getDeclaration())
				return [code, type.toTypescript()]
			})
			if (refs.length === 0) { return createResponse(Any, Any) }
			if (refs.length === 1) { return createResponse(Any, refs[0][1]) }
			return ts.createUnionTypeNode(refs.map(x => x[1]))
		})(ep.result)

		this.declarations.push(GenerateAsyncFunction(
			name + '_invoke',
			FunctionBody,
			parameters
				.filter(x => !x.type.isFalsy())
				.map(x => ts.createParameter(null, null, null, x.key, null, x.type.toTypescript())),
			returnTypesUnion,
			ep.comment
		))
	}
}
export function Generator(server: Server, template: string) {
	const transformer = new Transformer
	server.endpoints.map(x => transformer.endPointToDeclaration(x))
	// Read data
	const statements = transformer.statements.map(render).join('\n')
	const declarations = transformer.declarations.map(render).join('\n')
	const result = template += '\n' + statements + '\n' + declarations
	return render(ts.createSourceFile('generated.ts', result, ts.ScriptTarget.Latest, false)).
		replace(/@__JSDoc__ /g, '')
}
