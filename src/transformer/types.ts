import * as ts from 'typescript'
export enum Types { boolean = 0, number, string }
export enum FalsyType { null = 100, undefined }
export enum ComplexType { array = 200, object }
export enum ConstructedType { enum = 300, or, and, tuple }
export enum TypescriptType { any = -100, void }
export abstract class Type {
	abstract toString(): string
	abstract toTypescript(): ts.TypeNode
	type: Types | FalsyType | ComplexType | ConstructedType | TypescriptType
}
export class Void extends Type {
	type = TypescriptType.void
	toString() { return 'void' }
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword) }
}
export class Any extends Type {
	type = TypescriptType.any
	toString() { return 'any' }
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword) }
}
export class Literal extends Type {
	constructor(
		public value: boolean | number | string | undefined | null,
		/** Is this type have a concrete value? */public literal: boolean
	) {
		super()
		this.type = Types[typeof value] || FalsyType[typeof value] || FalsyType.null
	}
	toString() {
		if (this.value === undefined) return 'undefined'
		if (this.literal) return JSON.stringify(this.value)
		return Types[this.type]
	}
	toTypescript() {
		if (this.value === undefined) return ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
		if (this.value === null) return ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword)
		if (this.literal) return ts.createLiteralTypeNode(ts.createLiteral(this.value))
		return ts.createKeywordTypeNode(({
			boolean: ts.SyntaxKind.BooleanKeyword,
			string: ts.SyntaxKind.StringKeyword,
			number: ts.SyntaxKind.NumberKeyword
		})[typeof this.value])
	}
}

export class ArrayOf<T extends Type = Type> extends Type {
	type = ComplexType.array
	constructor(public of: T) { super() }
	toString() { return this.of.toString() + '[]' }
	toTypescript() {
		return ts.createArrayTypeNode(this.of.toTypescript())
	}
}

// class EnumOf extends Type {
// 	type = ConstructedType.enum
// 	constructor(public name: string, public of: string[]) { super() }
// 	toString() { return ``}
// }
export interface ObjectOfWhat {
	key: string, optional?: boolean, value: Type, jsdoc?: string,
}
export class ObjectOf extends Type {
	type = ComplexType.object
	constructor(public of: ObjectOfWhat[]) { super() }
	toString() {
		const r = '{' + this.of.map(t => `${t.key}${t.optional ? '?' : ''}: ${t.value.toString()}`).join(',\n') + '}'
		if (r === '{}') { return 'object' }
		return r
	}
	toTypescript() {
		return ts.createTypeLiteralNode(
			this.of.map(x => {
				return ts.createPropertySignature(
					void 0,
					/** name */x.key,
					/** question mark */x.optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : void 0,
					/** subtype */x.value.toTypescript(),
					void 0
				)
			})
		)
	}
}

export class Or extends Type {
	type = ConstructedType.or
	constructor(public of: Type[]) { super() }
	toString() {
		if (this.of.length === 0) return 'any'
		if (this.of.length === 1) return this.of[0].toString()
		return '(' + this.of.map(t => t.toString()).join(' | ') + ')'
	}
	toTypescript() {
		return ts.createUnionTypeNode(this.of.map(x => x.toTypescript()))
	}
}

export class And extends Type {
	type = ConstructedType.and
	constructor(public of: Type[]) { super() }
	toString() {
		if (this.of.length === 0) return 'any'
		if (this.of.length === 1) return this.of[0].toString()
		return '(' + this.of.map(t => t.toString()).join(' & ') + ')'
	}
	toTypescript() {
		return ts.createIntersectionTypeNode(this.of.map(x => x.toTypescript()))
	}
}

export class TupleOf extends Type {
	type = ConstructedType.tuple
	constructor(public of: Type[]) { super() }
	toString() { return '[' + this.of.map(t => t.toString()).join(', ') + ']' }
	toTypescript() {
		return ts.createTupleTypeNode(this.of.map(x => x.toTypescript()))
	}
}

export function shape(any: any): Type {
	if (any instanceof Type) {
		return any
	}
	if (['boolean', 'number', 'string', 'undefined'].indexOf(typeof any) + 1 || any === null) {
		return new Literal(any, false)
	}
	if (Array.isArray(any)) {
		return new ArrayOf(new Or(any.map(x => shape(x))))
	}
	return new ObjectOf(Object.keys(any).map(key => {
		return {
			key: key,
			value: shape(any[key]),
			optional: any[key] === undefined || any[key] === null
		}
	}))
}
