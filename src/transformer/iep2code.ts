import { Property, ArrayOf, BaseType, JSONType } from './json.type'
import * as Typescript from 'typescript'
import * as toTsType from './json2ast'

/** Printer that used by render  */
const [printer, doc] = [Typescript.createPrinter({
	newLine: Typescript.NewLineKind.LineFeed, removeComments: false
}), Typescript.createSourceFile('', '', Typescript.ScriptTarget.Latest)]

/** Typescript.Node -> string */
function render(node: Typescript.Node): string {
	return printer.printNode(
		Typescript.EmitHint.Unspecified,
		node,
		doc
	)
}

const { Tokens, getObjectPropSig } = toTsType
const getTsType = toTsType.default

export interface IEndPoint {
	comment?: string
	url: string
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	params: Property[]
	result: Property[] | ArrayOf
	name?: string
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

/** Generate interface code from endpoint */
function EndPoint2Interface(ep: IEndPoint): [string, string] {
	const name = getInterfaceName(ep)

	const paramsInterface = Typescript.createInterfaceDeclaration(void 0, [Tokens.Export],
		name + '_params', void 0, void 0, ep.params.map(getObjectPropSig))

	let resultInterface: Typescript.Node
	let i: Property[]
	if (ep.result instanceof Array) {
		i = ep.result
	} else if (ep.result._type === 'array') {
		if (ep.result.of._type === 'object') { i = [ep.result.of] }
		else if (ep.result.of._type === 'array') {
			/** type _return = { ... } */
			resultInterface = Typescript.createTypeAliasDeclaration(void 0, [Tokens.Export],
				name + '_return', void 0, getTsType(ep.result.of))
		} else {
			// Basic type, does not need an interface or type alias
			resultInterface = Typescript.createEmptyStatement()
		}
	}
	/** interface _return { ... } */
	resultInterface = resultInterface ||
		Typescript.createInterfaceDeclaration(void 0, [Tokens.Export],
			name + '_return', void 0, void 0, i.map(getObjectPropSig))
	return [render(paramsInterface), resultInterface ? render(resultInterface) : '']
}
function EndPoint2Code(ep: IEndPoint) {
	let name = getInterfaceName(ep)

	const createParam = (name: string, type: string) =>
		Typescript.createParameter(void 0, void 0, void 0, name, void 0,
			Typescript.createLiteralTypeNode(
				Typescript.createIdentifier(type)
			))
	/** Param of the generated function */
	let params = [createParam('options', `API.${name}_params`)];
	(urlparam => {
		if (urlparam === null) { return }
		/** create urlParam: { x: string | number, y: string | number } */
		params.unshift(createParam('urlParam', render(
			Typescript.createTypeLiteralNode(
				urlparam
					.map(x => x.replace(/{|}/g, ''))
					.map(name => Typescript.createPropertySignature([],
						name, void 0, Typescript.createLiteralTypeNode(
							Typescript.createIdentifier('string | number')
						), void 0
					)))
		)))
	})(getParamsInURL(ep.url))

	let returnType: string
	if (ep.result instanceof Array) {
		returnType = `API.${name}_return`
	} else {
		if (BaseType[ep.result.of._type]) {
			returnType = `${ep.result.of._type.toLowerCase()}[]`
		}
		else { returnType = `API.${name}_return[]` }
	}

	return `${ep.comment ? `/** ${ep.comment} */` : ''}
	protected ${name}(${params.map(render).join(', ')}): Promise<${returnType}> {
		const [url, init] = this._createFetchInit('${ep.url}', { method: '${ep.method}' },
			options${getParamsInURL(ep.url) ? ', urlParam' : ''})
        return this._return(this.fetch(url, init))
	}
`
}

export function Generator(schema: IEndPoint[], template: string) {
	let interfaces = schema.map(EndPoint2Interface).map(x => x.join('\n')).join('\n')
	let code = schema.map(EndPoint2Code).join('')
	let result = template.
		replace('// Interfaces will inject here', interfaces).
		replace('// Code here', code)
	return render(Typescript.createSourceFile('generated.ts', result, Typescript.ScriptTarget.Latest, false))
}
