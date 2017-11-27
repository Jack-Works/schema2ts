import * as ts from 'typescript'
const ValidCharsInURLSpecButNOTInVarName = '-._~:/?#[]@!&\'()*+,;='.split('')
export function getValidVarName(name: string) {
	return name
		.split('')
		.map(char => ValidCharsInURLSpecButNOTInVarName.indexOf(char) !== -1 ? '_' : char)
		.join('')
		.replace('{', '$').replace('}', '')
}
export function getParamsInURL(u: string) {
	return u.match(/{([a-zA-Z0-9_]+)}/g)
}
export const Export = ts.createToken(ts.SyntaxKind.ExportKeyword)
export const Extends = ts.createToken(ts.SyntaxKind.ExtendsKeyword)
