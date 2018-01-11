# Schema2ts internal express of type

[Code tells anything](./types.ts), then intellisense will tell you the rest.

If you get confused, fell free to open an [issue](https://github.com/Jack-Works/schema2ts/issues), then I will add that part to this document.

## About `Types.` and `Typescript.`

`Types.` means type in schema2ts

`Typescript.` means type provided by Typescript package

## Categories of Types

### Literal Type

* boolean (`true`, `false`)
* number (`-1`, `0.5`, `100`, ...)
* string (`'Hello'`, `'World'`, ...)

### Falsy Type

* null
* undefined

### Typescript Falsy Type

* any
* void

### Complex Type

* array (`Type[]`)
* object (with type definition by an `interface` of course)

### Constructed Type

* or (`TypeA | TypeB`)
* and (`TypeA & TypeB`)
* tuple (`[TypeA, TypeB]`)

### Typescript Type

* enum
* type reference

## Shared methods

### `toTypescript`(): `Typescript.TypeNode`

This method return the Typescript TypeNode of it self.

For example, _Types.Literal(true)_ express a boolean type, this method gives you a `boolean` TypeNode.

Then, _Types.EnumOf(name, members...)_ express an enum, this method gives you the `name`, not declaration.

### `reduce`(keepPrecise?: boolean): `Types.Type`

This method make type more clear.

For example, _Types.And([ TypeA, TypeA ]).reduce()_ (which express `TypeA & TypeA`) will give you `TypeA`

### `getDeclaration`(): `Typescript.Declaration[]`

This method gives you all type declaration you need to add to the output file, otherwise, result of _.toTypescript()_ will not pass type checking.

### `addJSDoc`(jsdoc: string | string[]): `void`

This method add JSDoc to the type.

**Important!**: But JSDoc maybe not emit in some types!
