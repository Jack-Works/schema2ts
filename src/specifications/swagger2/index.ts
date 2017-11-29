import * as Swagger2 from 'swagger2'
import { Server, IEndPoint } from '../../code/server'
import * as Types from '../../code/types'
import { Operation, Definition } from 'swagger2/dist/schema'

export function is(object: any, path: string): object is Swagger2.Document {
	if (object.swagger != '2.0') { return false }
	if (!Swagger2.validateDocument(object)) {
		throw new TypeError('Input file is not a valid Swagger2 specification, see http://bigstickcarpet.com/swagger-parser/www/index.html')
	}
	return true
}

const baseTypeMap = {
	string: '',
	boolean: true,
	integer: 1,
	number: 1
}

/** This def is missing in swagger2 */
interface SchemaObject {
	type: 'object' | 'reference' // reference is a inner type
	properties: {
		[key: string]: SchemaObject
	}
	description?: string
	/** required keys */required: string[]
	schema?: { $ref: string }
}
function Swagger2SchemaToTypes(x: SchemaObject | Definition, doc: Swagger2.Document): Types.Type {
	if (x === undefined) return new Types.Void
	if ((x.schema && x.schema.$ref) || (x as any).$ref) {
		x.type = 'reference' // let it fall to default case 
	}
	if (!x.type) {
		if ((x as any).schema) {
			x.type = (x as any).schema.type
		}
		else return new Types.Any()
	}
	switch (x.type as (typeof x.type | 'object')) {
		case 'string':
		case 'boolean':
		case 'integer':
		case 'number':
			return Types.shape(baseTypeMap[x.type])
		case 'array':
			return new Types.ArrayOf(Swagger2SchemaToTypes((x as Definition).items, doc))

		case 'object':
			if (x.schema && !x.schema.$ref) { return Swagger2SchemaToTypes(x.schema, doc) }
			const xs: SchemaObject = x as any
			const like = {}
			const keyTable = xs.properties
			for (const key in keyTable) {
				like[key] = Swagger2SchemaToTypes(keyTable[key], doc)
			}
			const type: Types.ObjectOf = Types.shape(like) as Types.ObjectOf
			type.of.forEach(y => y.jsdoc = keyTable[y.key].description)
			type.of.forEach(y => y.optional = xs.required && xs.required.indexOf(y.key) !== -1)
			if (type.of.length === 0) return new Types.Any
			return type

		default:
			const key = (x as any).$ref || x.schema.$ref
			if (key) {
				const k = key.replace('#/definitions/', '')
				return new Types.TypeReferenceType(k,
					Swagger2SchemaToTypes(doc.definitions[k], doc)
				)
			}
			throw new TypeError(`Unknown type: Can not handle this type of object ${JSON.stringify(x)}`)
	}
}
function Swagger2ParameterToObject(parameters: Operation['parameters'], doc: Swagger2.Document): Types.ObjectOf | Types.TypeReferenceType {
	if (!parameters[0]) { return new Types.ObjectOf([]) }
	if (parameters[0].$ref || (parameters[0].schema && parameters[0].schema.$ref)) {
		return Swagger2SchemaToTypes(parameters[0], doc) as Types.TypeReferenceType
	}
	return new Types.ObjectOf(parameters.filter(x => x).map(param => {
		return ({
			key: param.name,
			optional: !param.required,
			jsdoc: param.description,
			value: param.schema ? Swagger2SchemaToTypes(param.schema, doc) : Types.shape(baseTypeMap[param.type])
		})
	}))
}

function main(doc: Swagger2.Document): Server {
	const baseUrl = doc.basePath
	const endpoints: IEndPoint[] = []
	const enums: Types.EnumOf[] = []
	const interfaces: Types.TypeReferenceType[] = []
	function getEndpoints() {
		const paths = doc.paths
		for (const url in paths) {
			for (const method in paths[url]) {
				if (method === '$ref') {
					console.warn(`Swagger2: $ref for path (${url}) is not supported.`)
					continue
				}
				if (method === 'parameters') { continue }
				const p: Operation = paths[url][method]
				/** Now create endpoints for this (path, method) */
				const comment = p.description || p.summary
				type ObjOrRef = Types.ObjectOf | Types.TypeReferenceType
				const empty: ObjOrRef = new Types.ObjectOf([])
				let urlParams: ObjOrRef,
					bodyParams: ObjOrRef,
					headerParams: ObjOrRef,
					formParams: ObjOrRef,
					queryParams: ObjOrRef
				if (p.parameters) {
					urlParams = Swagger2ParameterToObject(p.parameters.filter(p => p.in === 'path'), doc)
					bodyParams = Swagger2ParameterToObject(p.parameters.filter(p => p.in === 'body'), doc)
					headerParams = Swagger2ParameterToObject(p.parameters.filter(p => p.in === 'header'), doc)
					formParams = Swagger2ParameterToObject(p.parameters.filter(p => p.in === 'formData'), doc)
					queryParams = Swagger2ParameterToObject(p.parameters.filter(x => x.in === 'query'), doc)
				} else {
					urlParams = bodyParams = headerParams = formParams = queryParams = empty
				}
				let result: [number, Types.Type][] = []
				if (p.responses) {
					result = Object.keys(p.responses).map(
						key => [
							parseInt(key, 10),
							Swagger2SchemaToTypes(p.responses[key], doc)
						] as [number, Types.Type]
					)
				}
				const name = (p as any).name || undefined
				let bodyParamsType: 'json' | 'form' = 'json'
				if (p.parameters) {
					bodyParamsType = p.parameters.some(p => p.in === 'formData') ? 'form' : 'json'
				}
				endpoints.push({
					comment, url, urlParams, headerParams, queryParams, result, name, bodyParamsType,
					bodyParams: bodyParamsType === 'json' ? bodyParams : formParams,
					method: method as any, modifier: {}
				})
			}
		}
	}
	getEndpoints()
	return {
		baseUrl,
		endpoints,
		enums,
		interfaces
	}
}
export function transformer(content: object, filePath: string) {
	return (): Server => {
		const document: Swagger2.Document = Swagger2.loadDocumentSync(filePath)
		// if (Swagger2.validateDocument(document)) {
		return main(document)
		// } else {
		// 	throw new TypeError('Not a valid Swagger2 schema!')
		// }
	}
}
