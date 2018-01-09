import * as ts from 'typescript'
export enum LiteralType {
    boolean = 1,
    number,
    string,
}
export enum FalsyType {
    null = -50,
    undefined,
}
export enum TypescriptFalsyType {
    any = -100,
    void,
}
export enum ComplexType {
    array = 200,
    object,
}
export enum ConstructedType {
    or = 300,
    and,
    tuple,
}
export enum TypescriptType {
    enum = 400,
    TypeReference,
}
export function isLiteralType(x: Type): x is Literal {
    return [LiteralType.boolean, LiteralType.number, LiteralType.string].some(y => x.type === y)
}
export function isObjectType(x: Type): x is ObjectOf {
    return x.type === ComplexType.object
}
export function isArrayType(x: Type): x is ArrayOf {
    return x.type === ComplexType.array
}
export function isVoidType(x: Type): x is Void {
    return x.type === TypescriptFalsyType.void
}
export function isTypeReference(x: Type): x is TypeReferenceType {
    return x.type === TypescriptType.TypeReference
}
export abstract class Type {
    abstract toTypescript(): ts.TypeNode
    /** Cut type information to be human-friendly, but maybe less precise */
    reduce(keepPrecise?: boolean): Type {
        return this
    }

    /** To make this type referenceable, what declaration need to generate */
    getDeclaration(): ts.Declaration[] {
        return []
    }
    type: LiteralType | FalsyType | ComplexType | ConstructedType | TypescriptFalsyType | TypescriptType
    isFalsy(this: Type): boolean {
        switch (this.type) {
            case TypescriptType.TypeReference:
                return (this as TypeReferenceType).of.isFalsy()
            case ComplexType.object:
                return (this as ObjectOf).of.length === 0
            default:
                const falsy: Record<any, number> = {
                    [FalsyType.null]: 1,
                    [FalsyType.undefined]: 1,
                    [TypescriptFalsyType.any]: 1,
                    [TypescriptFalsyType.void]: 1,
                }
                return !!falsy[this.type]
        }
    }
}
//#region Literal, Any, Void
export class Literal extends Type {
    constructor(
        public value: boolean | number | string | undefined | null,
        /** Does this type have a literal value? */ public literal: boolean,
    ) {
        super()
        this.type = (LiteralType[typeof value as any] || FalsyType[typeof value as any] || FalsyType.null) as any
    }
    toTypescript() {
        if (this.value === undefined) return ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
        if (this.value === null) return ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword)
        if (this.literal) {
            return ts.createLiteralTypeNode(ts.createLiteral(this.value) as
                | ts.StringLiteral
                | ts.NumericLiteral
                | ts.BooleanLiteral)
        }
        const keywords: Record<string, any> = {
            boolean: ts.SyntaxKind.BooleanKeyword,
            string: ts.SyntaxKind.StringKeyword,
            number: ts.SyntaxKind.NumberKeyword,
        }
        return ts.createKeywordTypeNode(keywords[typeof this.value])
    }
    reduce(keepPrecise?: boolean): Type {
        /** We will drop all literals here */
        if (this.literal && !keepPrecise) {
            return shape(this.value)
        } else return this
    }
}
export class Any extends Type {
    type = TypescriptFalsyType.any
    toTypescript() {
        return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
    }
}
export class Void extends Type {
    type = TypescriptFalsyType.void
    toTypescript() {
        return ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword)
    }
}
//#endregion
//#region ComplexType
export class ArrayOf<T extends Type = Type> extends Type {
    type = ComplexType.array
    constructor(public of: T) {
        super()
    }
    getDeclaration(): ts.Declaration[] {
        return this.of.getDeclaration()
    }
    toTypescript() {
        return ts.createArrayTypeNode(this.of.toTypescript())
    }
    reduce() {
        return new ArrayOf(this.of.reduce())
    }
}

export interface ObjectOfWhat {
    key: string
    optional?: boolean
    value: Type
    jsdoc?: string
    readonly?: boolean // TODO: Not implemented.
    defaultValue?: any // TODO: Not implemented.
}
export class ObjectOf extends Type {
    type = ComplexType.object
    constructor(public of: ObjectOfWhat[]) {
        super()
    }
    toTypescript() {
        return ts.createTypeLiteralNode(
            this.of.map(x => {
                if (!x.key) {
                    throw new TypeError('A unknown property name.')
                }
                return ts.createPropertySignature(
                    undefined,
                    /** name */ ts.createLiteral(x.key),
                    /** question mark */ x.optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                    /** subtype */ x.value.toTypescript(),
                    undefined,
                )
            }),
        )
    }
    reduce() {
        return new ObjectOf(
            this.of.map(x => {
                return { ...x, value: x.value.reduce() }
            }),
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
    constructor(public name: string, public of: string[], public val: string[] | number[] = []) {
        super()
    }
    getDeclaration(): ts.Declaration[] {
        /** `export enum name { of[0]: val[0], of[1]: val[1], ... }` */
        const self = ts.createEnumDeclaration(undefined, [ts.createToken(ts.SyntaxKind.ExportKeyword)], this.name, [
            ...this.of.map((member, index) => {
                const memberInitValue = ts.createLiteral(this.val[index])
                return ts.createEnumMember(member, this.val[index] && (memberInitValue as any))
            }),
        ])
        return [self]
    }
    toTypescript() {
        return ts.createTypeReferenceNode(this.name, [])
    }
}
export class TypeReferenceType extends Type {
    type = TypescriptType.TypeReference
    constructor(public ref: string, public of: Type) {
        super()
    }
    toTypescript() {
        if (this.isFalsy()) {
            if (isObjectType(this.of)) return new Void().toTypescript()
            if (isArrayType(this.of)) return ts.createArrayTypeNode(new Void().toTypescript())
            if (isVoidType(this.of)) return new Void().toTypescript()
            if (isLiteralType(this.of)) return this.of.toTypescript()
            return new Any().toTypescript()
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
        let d: ts.Declaration | null = null
        if (isTypeReference(this.of)) {
            return this.of.getDeclaration()
        }
        if (isObjectType(this.of)) {
            const getName = (x: ts.TypeElement) => {
                if (!x.name) return undefined
                if (ts.isIdentifier(x.name) || ts.isStringLiteral(x.name)) {
                    return x.name.text
                }
                return undefined
            }
            const getComment = (y: ts.TypeElement) => {
                const name = getName(y)
                if (!name) return
                this.of
            }
            const nodes = this.of.toTypescript().members
            nodes
                .map(node => ({ name: getName(node), node }))
                .filter(x => x.name)
                .map(x => {
                    return { comment: (this.of as ObjectOf).of.filter(key => key.key === x.name)[0], ...x }
                })
                .filter(x => x.comment && x.comment.jsdoc)
                .forEach(x => {
                    ts.addSyntheticLeadingComment(x.node, ts.SyntaxKind.MultiLineCommentTrivia, x.comment.jsdoc!)
                })
            d = ts.createInterfaceDeclaration(
                void 0,
                [ts.createToken(ts.SyntaxKind.ExportKeyword)],
                this.ref,
                void 0,
                void 0,
                nodes,
            )
        } else {
            d = ts.createTypeAliasDeclaration(
                undefined,
                [ts.createToken(ts.SyntaxKind.ExportKeyword)],
                this.ref,
                [],
                this.of.toTypescript(),
            )
        }
        return [...this.of.getDeclaration(), d]
    }
}
//#endregion
//#region ConstructedType Helper
function RemoveDuplicateBaseType(x: Type[]): Type[] {
    const newTypes: Type[] = []
    x.forEach(o => {
        if (
            FalsyType[o.type] ||
            (LiteralType[o.type] && (<Literal>o).literal === false) ||
            TypescriptFalsyType[o.type]
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
    if (keys.length > 20) {
        keys.forEach(x => (x.key = '[key: string]'))
    }
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
            const more = { optional: true, value: new Any() }
            if (x.value.type === FalsyType.null || x.value.type === FalsyType.undefined) return { ...x, ...more }
            return x
        })
    }
}
const ReduceForConstructedType = (x: Type[]) =>
    CombineObjectType(
        RemoveDuplicateBaseType(
            // after this reduce, something like 1 | 3 will become number | number
            // so we need to RemoveDuplicateBaseType again
            x.map(x => x.reduce()),
        ),
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
    reduce(): Type {
        const r = GetFlattedAndOr(this, ReduceForConstructedType(this.of))
        if (r.length === 0) return new Any()
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
    reduce(): Type {
        const r = GetFlattedAndOr(this, ReduceForConstructedType(this.of))
        if (r.length === 0) return new Any()
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
    constructor(public of: Type[]) {
        super()
    }
    toTypescript() {
        return ts.createTupleTypeNode(this.of.map(x => x.toTypescript()))
    }
    reduce() {
        return new TupleOf(this.of.map(x => x.reduce()))
    }
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
    } else
        returnValue = new ObjectOf(
            Object.keys(any).map(key => {
                return {
                    key: key,
                    value: shape(any[key]),
                    optional: any[key] === undefined || any[key] === null,
                }
            }),
        )
    if (guessMode === true) return returnValue.reduce()
    return returnValue
}
