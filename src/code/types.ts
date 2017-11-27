import * as ts from 'typescript'
export enum LiteralType { boolean = 1, number, string }
export enum FalsyType { null = -50, undefined }
export enum TypescriptFalsyType { any = -100, void }
export enum ComplexType { array = 200, object }
export enum ConstructedType { or = 300, and, tuple }
export enum TypescriptType { enum = 400, TypeReference }
export function is<T extends Type>(x: Type, type: Type['type'] | Type['type'][]): x is T {
	if (Array.isArray(type)) { return type.some(y => x.type === y) }
	return x.type === type
}
export abstract class Type {
	abstract toTypescript(): ts.TypeNode
	/** Cut type information to be human-friendly, but maybe less precise */
	reduce(keepPrecise?: boolean): Type { return this }

	/** To make this type referenceable, what declaration need to generate */
	getDeclaration(): ts.Declaration[] { return [] }
	type: LiteralType | FalsyType | ComplexType | ConstructedType | TypescriptFalsyType | TypescriptType
	isFalsy(this: Type): boolean {
		switch (this.type) {
			case TypescriptType.TypeReference:
				return (this as TypeReferenceType).of.isFalsy()
			case ComplexType.object:
				return (this as ObjectOf).of.length === 0
			default:
				const falsy = {
					[FalsyType.null]: 1, [FalsyType.undefined]: 1, [TypescriptFalsyType.any]: 1,
					[TypescriptFalsyType.void]: 1
				}
				return falsy[this.type]
		}
	}
}
//#region Literal, Any, Void
export class Literal extends Type {
	constructor(
		public value: boolean | number | string | undefined | null,
		/** Does this type have a literal value? */public literal: boolean
	) {
		super()
		this.type = LiteralType[typeof value] || FalsyType[typeof value] || FalsyType.null
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
	reduce(keepPrecise?: boolean) {
		/** We will drop all literals here */
		if (this.literal && !keepPrecise) { return shape(this.value) }
		else return this
	}
}
export class Any extends Type {
	type = TypescriptFalsyType.any
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword) }
}
export class Void extends Type {
	type = TypescriptFalsyType.void
	toTypescript() { return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword) }
}
//#endregion
//#region ComplexType
export class ArrayOf<T extends Type = Type> extends Type {
	type = ComplexType.array
	constructor(public of: T) { super() }
	getDeclaration(): ts.Declaration[] { return this.of.getDeclaration() }
	toTypescript() { return ts.createArrayTypeNode(this.of.toTypescript()) }
	reduce() { return new ArrayOf(this.of.reduce()) }
}

export interface ObjectOfWhat { key: string, optional?: boolean, value: Type, jsdoc?: string, }
export class ObjectOf extends Type {
	type = ComplexType.object
	constructor(public of: ObjectOfWhat[]) { super() }
	toTypescript() {
		return ts.createTypeLiteralNode(
			this.of.map(x => {
				if (!x.key) {
					throw new TypeError('A unknown property name.')
				}
				return ts.createPropertySignature(
					null,
					/** name */ts.createLiteral(x.key),
					/** question mark */x.optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : null,
					/** subtype */x.value.toTypescript(),
					null
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
	getDeclaration(): ts.Declaration[] {
		const x: ts.Declaration[] = []
		this.of.forEach(_ => x.push(..._.value.getDeclaration()))
		return x
	}

}
//#endregion
//#region Typescript Type
export class EnumOf extends Type {
	type = TypescriptType.enum
	constructor(public name: string, public of: string[], public val: string[] | number[] = []) { super() }
	getDeclaration(): ts.Declaration[] {
		/** `export enum name { of[0]: val[0], of[1]: val[1], ... }` */
		const self = ts.createEnumDeclaration(null, [ts.createToken(ts.SyntaxKind.ExportKeyword)], this.name, [
			...this.of.map((member, index) => {
				const memberInitValue = ts.createLiteral(this.val[index])
				return ts.createEnumMember(member, this.val[index] && memberInitValue)
			})
		])
		return [self]
	}
	toTypescript() { return ts.createTypeReferenceNode(this.name, []) }
}
export class TypeReferenceType extends Type {
	type = TypescriptType.TypeReference
	constructor(public ref: string, public of: Type) { super() }
	toTypescript() {
		if (this.isFalsy()) {
			if (is<ObjectOf>(this.of, ComplexType.object)) return (new Void).toTypescript()
			if (is<ArrayOf>(this.of, ComplexType.array)) return ts.createArrayTypeNode((new Void).toTypescript())
			if (is<Void>(this.of, TypescriptFalsyType.void)) return (new Void).toTypescript()
			if (is<Literal>(this.of, [FalsyType.null, FalsyType.undefined, LiteralType.boolean])) return this.of.toTypescript()
			return (new Any).toTypescript()
		}
		return ts.createTypeReferenceNode(this.ref, [])
	}
	getDeclaration(): ts.Declaration[] {
		if (this.isFalsy()) {
			return []
		}
		/** If this.of is eliminated, do not generate type reference
		 *  if this.of is a Object, generate an interface
		 *  otherwise, generate a type alias (type X = Type)
		 */
		let d: ts.Declaration = null
		if (is<ObjectOf>(this.of, ComplexType.object)) {
			const jsDocObj = new ObjectOf(this.of.of.map(x => { // clone a ObjectOf but jsdoc version
				if (!x.jsdoc) return x
				const y = { ...x }
				y.key = `/** ${x.jsdoc} */` + x.key
				return y
			}))
			d = ts.createInterfaceDeclaration(
				void 0, [ts.createToken(ts.SyntaxKind.ExportKeyword)], this.ref,
				void 0, void 0, jsDocObj.toTypescript().members)
		}
		d = ts.createTypeAliasDeclaration(null, [ts.createToken(ts.SyntaxKind.ExportKeyword)], this.ref, [], this.of.toTypescript())
		return [...this.of.getDeclaration(), d]
	}
}
//#endregion
//#region ConstructedType Helper
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
//#endregion
//#region ConstructedType
export class Or extends Type {
	type = ConstructedType.or
	constructor(public of: Type[]) {
		super()
		this.of = RemoveDuplicateBaseType(this.of)
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
	getDeclaration(): ts.Declaration[] {
		const x: ts.Declaration[] = []
		this.of.forEach(_ => x.push(..._.getDeclaration()))
		return x
	}
}
export class And extends Type {
	type = ConstructedType.and
	constructor(public of: Type[]) {
		super()
		this.of = RemoveDuplicateBaseType(of)
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
	getDeclaration() {
		const x: ts.Declaration[] = []
		this.of.forEach(_ => x.push(..._.getDeclaration()))
		return x
	}
}
export class TupleOf extends Type {
	type = ConstructedType.tuple
	constructor(public of: Type[]) { super() }
	toTypescript() {
		return ts.createTupleTypeNode(this.of.map(x => x.toTypescript()))
	}
	reduce() { return new TupleOf(this.of.map(x => x.reduce())) }
	getDeclaration() {
		const x: ts.Declaration[] = []
		this.of.forEach(_ => x.push(..._.getDeclaration()))
		return x
	}
}
//#endregion
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
