import * as ts from 'typescript'
import { Export, AnyType } from './constants'
const ValidCharsInURLSpecButNOTInVarName = '-._~:/?#[]@!&\'()*+,;='.split('')
export function getValidVarName(name: string) {
	return name
		.split('')
		.map(char => ValidCharsInURLSpecButNOTInVarName.indexOf(char) !== -1 ? '_' : char)
		.join('')
		.replace('{', '$').replace('}', '')
}

/** Create a Typescript Async function Declaration */
export function GenerateAsyncFunction(
	name: string | ts.Identifier,
	body: ts.FunctionBody,
	parameters: ts.ParameterDeclaration[] = [],
	returnType: ts.TypeNode = AnyType,
	JSDocCommet?: string,
	modifiers: ts.Modifier[] = [],
	decorators: ts.Decorator[] = []) {
	const JSDoc: ts.Decorator | undefined = JSDocCommet ?
		ts.createDecorator(ts.createIdentifier(`__JSDoc__ /** ${JSDocCommet} */`)) : undefined
	const tdecorator: ts.Decorator[] = [JSDoc as ts.Decorator, ...decorators].filter(x => x)
	const returnTypePromise = ts.createTypeReferenceNode('Promise', [returnType])
	return ts.createFunctionDeclaration(
		tdecorator, [Export, ...modifiers],
		undefined, name, undefined, parameters, returnTypePromise, body
	)
}
