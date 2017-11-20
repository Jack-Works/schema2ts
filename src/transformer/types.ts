import * as ts from 'typescript'
export enum LiteralType { boolean = 1, number, string }
export enum FalsyType { null = 100, undefined }
export enum ComplexType { array = 200, object }
export enum ConstructedType { enum = 300, or, and, tuple }
export enum TypescriptType { TypeReference = 400 }
export enum TypescriptFalsyType { any = -100, void }
export abstract class Type {
	/** Transform Type to string, that in format of Typescript interface */
	abstract toString(): string
	/** Transform Type to Typescript.TypeNode for future use */
	abstract toTypescript(): ts.TypeNode
	/** Cut type information to be human-friendly, but less precise */
	abstract reduce(): Type
	type: LiteralType | FalsyType | ComplexType | ConstructedType | TypescriptFalsyType | TypescriptType
}
export class TypeReference extends Type {
	constructor(public ref: string) { super() }
	type = TypescriptType.TypeReference
	toString() { return this.ref }
	reduce() { return this }
	toTypescript() { return ts.createTypeReferenceNode(this.ref, []) }
}
export class Void extends Type {
	type = TypescriptFalsyType.void
	toString() { return 'void' }
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword) }
	reduce() { return this }
}
export class Any extends Type {
	type = TypescriptFalsyType.any
	toString() { return 'any' }
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword) }
	reduce() { return this }
}
export class Literal extends Type {
	constructor(
		public value: boolean | number | string | undefined | null,
		/** Is this type have a concrete value? */public literal: boolean
	) {
		super()
		this.type = LiteralType[typeof value] || FalsyType[typeof value] || FalsyType.null
	}
	toString() {
		if (this.value === undefined) return 'undefined'
		if (this.literal) return JSON.stringify(this.value)
		return LiteralType[this.type]
	}
	toTypescript() {
		if (this.value === undefined) return ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
		if (this.value === null) return ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword)
		if (this.literal) return ts.createLiteralTypeNode(ts.createLiteral(this.value.toString()))
		return ts.createKeywordTypeNode(({
			boolean: ts.SyntaxKind.BooleanKeyword,
			string: ts.SyntaxKind.StringKeyword,
			number: ts.SyntaxKind.NumberKeyword
		})[typeof this.value])
	}
	reduce() {
		/** We will drop all literals here */
		if (this.literal) { return shape(this.value) }
		else return this
	}
}

export class ArrayOf<T extends Type = Type> extends Type {
	type = ComplexType.array
	constructor(public of: T) { super() }
	toString() { return this.of.toString() + '[]' }
	toTypescript() {
		return ts.createArrayTypeNode(this.of.toTypescript())
	}
	reduce() {
		return new ArrayOf(this.of.reduce())
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
		const r = '{' + this.of.map(t => `${t.key}${t.optional ? '?' : ''}: ${t.value.toString()}`).join(',') + '}'
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
	reduce() {
		return new ObjectOf(
			this.of.map(x => {
				return { ...x, value: x.value.reduce() }
			})
		)
	}
}
function RemoveDuplicateBaseType(x: Type[]): Type[] {
	const newTypes: Type[] = []
	x.forEach(o => {
		if (
			FalsyType[o.type]
			|| (LiteralType[o.type] && (<Literal>o).literal === false)
			|| TypescriptFalsyType[o.type]
		) {
			if (newTypes.some(x => x.type === o.type)) return
		}
		newTypes.push(o)
	})
	return newTypes.filter(x => !FalsyType[x.type] && !TypescriptFalsyType[x.type])
}
function CombineObjectType(x: Type[]): Type[] {
	const otherTypes: Type[] = x.filter(y => y.type !== ComplexType.object)
	const allObjects: ObjectOf[] = x.filter(y => y.type === ComplexType.object) as ObjectOf[]

	const reducedKeys: ObjectOfWhat[] = []
	const keys: ObjectOfWhat[] = []
	allObjects.map(x => x.of).forEach(x => keys.push(...x))
	/** We guess it is a dictionary if it has more than 20 keys
	 *  so we set their keys to [key: string]
	 *  this will generate like this: { [key: string]: type }
	 */
	if (keys.length > 20) { keys.forEach(x => x.key = '[key: string]') }
	for (const key of keys) {
		const loadedKey = reducedKeys.filter(x => x.key === key.key)
		if (loadedKey.length) {
			const it = loadedKey[0]
			it.value = new Or([it.value, key.value]).reduce()
			it.jsdoc += '\n' + key.jsdoc
			it.optional = it.optional || key.optional
		} else {
			reducedKeys.push(key)
		}
	}
	const result = MakeFalsyTypeToAny(reducedKeys)
	if (result.length) return [...otherTypes, new ObjectOf(result)]
	return otherTypes
	function MakeFalsyTypeToAny(o: ObjectOfWhat[]) {
		return o.map(x => {
			const more = { optional: true, value: new Any }
			if (x.value.type === FalsyType.null || x.value.type === FalsyType.undefined) return { ...x, ...more }
			return x
		})
	}
}
const ReduceForConstructedType = (x: Type[]) => CombineObjectType(
	RemoveDuplicateBaseType(
		// after this reduce, something like 1 | 3 will become number | number
		// so we need to RemoveDuplicateBaseType again
		x.map(x => x.reduce())
	)
)

function GetFlattedAndOr(self: And | Or, x: Type[]): Type[] {
	const result = x.filter(y => y.type !== self.type)
	const others = x.filter(y => y.type === self.type)
	if (others.length) return result.concat(...others.map(x => GetFlattedAndOr(self, (x as And | Or).of)))
	return result
}
export class Or extends Type {
	type = ConstructedType.or
	constructor(public of: Type[]) {
		super()
		this.of = RemoveDuplicateBaseType(this.of)
	}
	toString() {
		if (this.of.length === 0) return 'any'
		if (this.of.length === 1) return this.of[0].toString()
		return '(' + this.of.map(t => t.toString()).join(' | ') + ')'
	}
	toTypescript() {
		return ts.createUnionTypeNode(this.of.map(x => x.toTypescript()))
	}
	reduce() {
		const r = GetFlattedAndOr(this, ReduceForConstructedType(this.of))
		if (r.length === 0) return new Any
		if (r.length === 1) return r[0]
		return new Or(r)
	}
}

export class And extends Type {
	type = ConstructedType.and
	constructor(public of: Type[]) {
		super()
		this.of = RemoveDuplicateBaseType(of)
	}
	toString() {
		if (this.of.length === 0) return 'any'
		if (this.of.length === 1) return this.of[0].toString()
		return '(' + this.of.map(t => t.toString()).join(' & ') + ')'
	}
	toTypescript() {
		return ts.createIntersectionTypeNode(this.of.map(x => x.toTypescript()))
	}
	reduce() {
		const r = GetFlattedAndOr(this, ReduceForConstructedType(this.of))
		if (r.length === 0) return new Any
		if (r.length === 1) return r[0]
		return new And(r)
	}
}

export class TupleOf extends Type {
	type = ConstructedType.tuple
	constructor(public of: Type[]) { super() }
	toString() { return '[' + this.of.map(t => t.toString()).join(', ') + ']' }
	toTypescript() {
		return ts.createTupleTypeNode(this.of.map(x => x.toTypescript()))
	}
	reduce() { return new TupleOf(this.of.map(x => x.reduce())) }
}

/** Geneate a shape of the object
 * if guessMode is on, we will generate a more grace but less correctness type for it
 */
export function shape(any: any, guessMode?: boolean): Type {
	let returnValue: Type
	if (any instanceof Type) {
		returnValue = any
	} else if (['boolean', 'number', 'string', 'undefined'].indexOf(typeof any) + 1 || any === null) {
		returnValue = new Literal(any, false)
	} else if (Array.isArray(any)) {
		returnValue = new ArrayOf(new Or(any.map(x => shape(x))))
	}
	else returnValue = new ObjectOf(Object.keys(any).map(key => {
		return {
			key: key,
			value: shape(any[key]),
			optional: any[key] === undefined || any[key] === null
		}
	}))
	if (guessMode === true) return returnValue.reduce()
	return returnValue
}

ts
