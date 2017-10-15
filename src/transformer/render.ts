import * as ts from 'typescript'
import * as Types from './types'

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

export interface IEndPoint {
	/** JSDoc comment that will be added to top of the function */comment?: string
	/** Entry point */url: string
	/** HTTP Method */method: string
	/** Path Parameters */urlParams?: Types.ObjectOf
	/** Body parameters */bodyParams?: Types.ObjectOf
	/** Query parameters */query?: Types.ObjectOf
	/** Return type */result?: Types.Type
	/** Code-friendly name of the function */name?: string
	/** More and more */modifier?: {
		depercated?: boolean
	}
}
function transformUrl(url: string) {
	return url.
		replace(/(\/| |_)/g, '_').replace(/{/g, '$').replace(/}/g, '')
}
function getInterfaceName(ep: IEndPoint) {
	return transformUrl(ep.name || ep.url + '_' + ep.method.toUpperCase())
}
function getParamsInURL(u: string) {
	const reg = /{([a-zA-Z0-9_]+)}/g
	return u.match(reg)
}
const Tokens = {
	protected: ts.createToken(ts.SyntaxKind.ProtectedKeyword),
	export: ts.createToken(ts.SyntaxKind.ExportKeyword),
	extends: ts.createToken(ts.SyntaxKind.ExtendsKeyword)
}

function GenerateMethod(
	name: string,
	parameters: { key: string, type: string }[],
	returnType: ts.TypeNode | string | undefined,
	body: ts.Block,
	JSDocCommet?: string,
	modifier?: ts.Modifier[],
	decorator?: ts.Decorator[]) {
	const tparameters = parameters.filter(x => x.type).map(x => {
		return ts.createParameter(void 0, void 0, void 0, x.key, void 0, ts.createTypeReferenceNode(x.type, void 0))
	})
	// TODO: Typescript Does not support generate jsdoc, so we have to make a fake decorator
	const JSDoc: ts.Decorator = JSDocCommet && ts.createDecorator(ts.createIdentifier(`__JSDoc__ /** ${JSDocCommet} */`))
	const tdecorator = [JSDoc, ...(decorator || [])]
	const tmodifier = [Tokens.protected, ...(modifier || [])]
	const returnTypeRef = (typeof returnType === 'string') ? ts.createTypeReferenceNode(returnType, void 0) : returnType
	return ts.createMethod(tdecorator, tmodifier,
		void 0, name, void 0, void 0, tparameters,
		returnTypeRef, body
	)
}

function GenerateInterface(x: Types.Type, name: string): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | string {
	switch (x.type) {
		case Types.Types.boolean:
		case Types.Types.number:
		case Types.Types.string:
			return Types.Types[x.type]

		case Types.ComplexType.object:
			const obj = x as Types.ObjectOf
			if (obj.of.length === 0) return 'void' // interface elimination
			const jsDocObj = new Types.ObjectOf(obj.of.map(x => { // clone a ObjectOf but jsdoc version
				if (!x.jsdoc) return x
				const y = { ...x }
				y.key = `/** ${x.jsdoc} */` + x.key
				return y
			}))
			return ts.createInterfaceDeclaration(
				void 0, [Tokens.export], name,
				void 0, void 0, jsDocObj.toTypescript().members)
		case Types.ComplexType.array:
			/**
			 * create interface $name extends Array<sth> {}
			 */
			return ts.createInterfaceDeclaration(
				void 0, [Tokens.export], name,
				void 0, [
					ts.createHeritageClause(Tokens.extends.kind, [
						ts.createExpressionWithTypeArguments(
							[(x as Types.ArrayOf).toTypescript().elementType],
							ts.createIdentifier('Array')
						)
					])
				], []
			)
		case Types.FalsyType.null:
		case Types.FalsyType.undefined:
		case Types.TypescriptType.any:
			return 'any'
		case Types.TypescriptType.void:
			return 'void'

		default:
			throw new SyntaxError(`${ts.SyntaxKind[x.toTypescript().kind]} node should not appear here`)
	}
}
class Transformer {
	interfaces: { [key: string]: (ts.InterfaceDeclaration | ts.TypeAliasDeclaration | string) } = {}
	methods: ts.MethodDeclaration[] = []
	transform(ep: IEndPoint) {
		const name = getInterfaceName(ep)
		const pathParams = GenerateInterface(ep.urlParams, name + '_url')
		const bodyParams = GenerateInterface(ep.bodyParams, name + '_body')
		const query = GenerateInterface(ep.query, name + '_query')
		const returnType = GenerateInterface(ep.result, name + '_result')

		this.interfaces[name + '_url'] = pathParams
		this.interfaces[name + '_body'] = bodyParams
		this.interfaces[name + '_query'] = query
		this.interfaces[name + '_result'] = returnType

		const chooseCorrectTypeRef = (typeLit, typeRef) => {
			if (ts.isInterfaceDeclaration(typeLit) && typeLit.members.length === 0) return 'void'
			if (typeof typeLit === 'string') return typeLit
			return typeRef
		}
		const parameters = [{
			key: 'url', type: chooseCorrectTypeRef(pathParams, 'API.' + name + '_url')
		}, {
			key: 'query', type: chooseCorrectTypeRef(query, 'API.' + name + '_query')
		}, {
			key: 'data', type: chooseCorrectTypeRef(bodyParams, 'API.' + name + '_body')
		}]
		this.methods.push(GenerateMethod(
			name,
			parameters.filter(x => x.type !== 'void'),
			undefined, // left return type for type inference
			ts.createBlock([ts.createStatement(
				ts.createIdentifier(`
					return this.__<${
					chooseCorrectTypeRef(returnType, name + '_result')
					}>('${ep.url}', '${ep.method.toUpperCase()}', ${
					parameters.map(x => x.type === 'void' ? 'undefined' : x.key).join(', ')
					})`)
			)]),
			ep.comment
		))
	}
	static render(typeRef: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | string | ts.MethodDeclaration): string {
		if (typeof typeRef === 'string') return ''
		else return render(typeRef)
	}
}
import { values } from '../utils'
export function Generator(schema: IEndPoint[], template: string) {
	const transformer = new Transformer
	schema.map(x => transformer.transform(x))
	const interfaces = values(transformer.interfaces).map(Transformer.render).join('\n')
	const methods = transformer.methods.map(Transformer.render).join('\n')
	const result = template.
		replace('// Interfaces will inject here', interfaces).
		replace('// Code here', methods)
	return render(ts.createSourceFile('generated.ts', result, ts.ScriptTarget.Latest, false)).
		replace(/@__JSDoc__ /g, '')
}
