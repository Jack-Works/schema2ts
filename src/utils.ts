import * as ts from 'typescript'
const ValidCharsInURLSpecButNOTInVarName = /-\._\~\:\/?#\[\]@\!\&'\(\)\*\+,;=`/g
export function getValidVarName(name: string) {
	return name.replace(ValidCharsInURLSpecButNOTInVarName, '_')
}
export function getParamsInURL(u: string) {
	return u.match(/{([a-zA-Z0-9_]+)}/g)
}
export const Export = ts.createToken(ts.SyntaxKind.ExportKeyword)
export const Extends = ts.createToken(ts.SyntaxKind.ExtendsKeyword)
