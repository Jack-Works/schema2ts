import * as Typescript from 'typescript'
const { SyntaxKind, createToken, createKeywordTypeNode } = Typescript
import { JSONType, BaseType, Property } from './json.type'
export const Tokens = {
	Optional: createToken(SyntaxKind.QuestionToken),
	String: createKeywordTypeNode(SyntaxKind.StringKeyword),
	Number: createKeywordTypeNode(SyntaxKind.NumberKeyword),
	Boolean: createKeywordTypeNode(SyntaxKind.BooleanKeyword),
	Null: createKeywordTypeNode(SyntaxKind.NullKeyword),
	Export: createToken(SyntaxKind.ExportKeyword)
}
export function getObjectPropSig(node: Property): Typescript.PropertySignature {
	return Typescript.createPropertySignature([],
		// See: https://github.com/Microsoft/TypeScript/issues/18661
		(node.comment ? `/** ${node.comment} */` : '') + node.key,
		node.optional && Tokens.Optional,
		getTsType(node.type),
		undefined
	)
}
export default function getTsType(node: JSONType, originNode?: boolean): Typescript.TypeNode {
	switch (node._type) {
		case 'array':
			return Typescript.createArrayTypeNode(getTsType(node.of))
		case 'object':
			return Typescript.createTypeLiteralNode([getObjectPropSig(node)])
		case BaseType.boolean:
			return Tokens.Boolean
		case BaseType.null:
			return Tokens.Null
		case BaseType.number:
			return Tokens.Number
		case BaseType.string:
			return Tokens.String
		default:
			console.error(node)
			throw new TypeError('Unknown Type')
	}
}
