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
	endPointToDeclaration(ep: IEndPoint) {
		// TODO: Bug: name does not generated correctly
		const name = getValidVarName(ep.url)
		ep.name = ep.name || name
		function toReference(type: Types.Type, name): Types.TypeReferenceType {
			if (Types.is<Types.TypeReferenceType>(type, Types.TypescriptType.TypeReference)) { return type }
			return new Types.TypeReferenceType(name, type)
		}
		const pathParams = toReference(ep.urlParams, name + '_parameter_path')
		const bodyParams = toReference(ep.bodyParams, name + '_parameter_body')
		const queryParams = toReference(ep.queryParams, name + '_parameter_query')
		const headerParams = toReference(ep.headerParams, name + '_parameter_header')
		// TODO: Bug: v this step does not generate any interface
		this.declarations.push(...[pathParams, bodyParams, queryParams]
			.reduce<ts.Declaration[]>((decs, curr) => {
				decs.push(...curr.getDeclaration())
				return decs
			}, []))

		const parameters = [
			{ key: 'url', type: pathParams },
			{ key: 'query', type: queryParams },
			{ key: 'data', type: bodyParams },
			{ key: 'header', type: headerParams }
		]
		/** Create function below */
		// TODO: Bug: url & method are not TypeReference, they are Value
		const url = new Types.TypeReferenceType(name + '_url', new Types.Literal(ep.url, true))
		const method = new Types.TypeReferenceType(name + '_method', new Types.Literal(ep.method.toUpperCase(), true))
		this.declarations.push(...url.getDeclaration(), ...method.getDeclaration())
		const lit = x => ts.createLiteral(x)
		const FunctionBody: ts.FunctionBody = ts.createBlock([
			ts.createReturn(
				// _Config.request(...)
				ts.createCall(lit('_Config.request'), null, [
					// name_url, name_method, { query, body, path, headers, bodyType}
					lit(name + '_url'),
					lit(name + '_method'),
					ts.createObjectLiteral([
						ts.createPropertyAssignment('query', lit(queryParams.toTypescript())),
						ts.createPropertyAssignment('body', lit(bodyParams.toTypescript())),
						ts.createPropertyAssignment('path', lit(pathParams.toTypescript())),
						ts.createPropertyAssignment('headers', lit(headerParams.toTypescript())),
						ts.createPropertyAssignment('bodyType', lit(ep.bodyParamsType)),
					])
				])
			)
		])
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
				.filter(x => x.type.isFalsy())
				.map(x => ts.createParameter(null, null, null, x.key, null, x.type.toTypescript())),
			returnTypesUnion,
			ep.comment
		))
	}
	static render(typeRef: ts.Declaration): string {
		if (typeof typeRef === 'string') return ''
		// TODO: Fail: Typescript: "Literal kind '105' not accounted for."
		else return render(typeRef)
	}
}
export function Generator(server: Server, template: string) {
	const transformer = new Transformer
	server.endpoints.map(x => transformer.endPointToDeclaration(x))
	// Read data
	const declarations = transformer.declarations.map(Transformer.render).join('\n')
	const result = template += '\n' + declarations
	return render(ts.createSourceFile('generated.ts', result, ts.ScriptTarget.Latest, false)).
		replace(/@__JSDoc__ /g, '')
}
