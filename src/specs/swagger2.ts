import { IEndPoint, ExtraData } from '../transformer/render'
import * as Types from '../transformer/types'
import { Swagger2Doc } from './swagger2.ns'
import { entries, values } from '../utils'
import { TypeReference } from '../transformer/types'
export function is(obj: any): obj is Swagger2Doc {
	return obj.swagger == '2.0'
}

const baseTypeMap = {
	string: '',
	boolean: true,
	integer: 1,
	number: 1
}
function swg2schema2types(x: Swagger2Doc.Schema): Types.Type {
	if (x === undefined) return new Types.Void
	switch (x.type) {
		case 'string':
		case 'boolean':
		case 'integer':
		case 'number':
			return Types.shape(baseTypeMap[x.type])

		case 'object':
			const like = {}
			for (const key in x.properties) {
				like[key] = swg2schema2types(x.properties[key])
			}
			const type: Types.ObjectOf = Types.shape(like) as Types.ObjectOf
			type.of.forEach(y => y.jsdoc = x.properties[y.key].description)
			type.of.forEach(y => y.optional = x.required && x.required.indexOf(y.key) !== -1)
			if (type.of.length === 0) return new Types.Any
			return type
		case 'array':
			return new Types.ArrayOf(swg2schema2types(x.items))

		default:
			const key = (x as any).$ref
			if (key) { return new TypeReference(key.replace('#/definitions/', '')) }
			throw new TypeError(`Unknown type: Can not handle this type of object ${JSON.stringify(x)}`)
	}
}
function swg2param2obj(parameters: Swagger2Doc.EndPoint['parameters']): Types.ObjectOf {
	return new Types.ObjectOf(parameters.filter(x => x).map(param => {
		return ({
			key: param.name,
			optional: !param.required,
			jsdoc: param.description,
			value: param.schema ? swg2schema2types(param.schema) : Types.shape(baseTypeMap[param.type])
		})
	}))
}


/** Transformer */
export function transform(obj: Swagger2Doc): IEndPoint[] {
	const results: IEndPoint[] = []
	for (
		const [
			/** API Endpoint, like /api/login */path,
			/** Shape of API Endpoint, {[keyof HTTPMethods]: ...} */shapes
		] of entries<Swagger2Doc.HTTPMethods>(obj.paths)) {
		for (
			const [
				/** HTTP method, like GET, POST */method,
				/** Shape of this method on this path, like shape of GET /api/books/ */shape
			] of entries<Swagger2Doc.EndPoint>(shapes as any)) {
			/** There are 3 types of parameter
			 *  In path (/{id}), in body (POST {obj: x}), in query (GET /?x=1)
			 */
			const parameters = shape.parameters || []
			const inPath = parameters.filter(x => x.in === 'path')
			const inBody = parameters.filter(x => x.in === 'body')[0]
			const inQuery = parameters.filter(x => x.in === 'query')
			let result: {
				description: string
				schema?: Swagger2Doc.SchemaObject | { $ref: string }
			} = { description: 'This method has no response type' }
			if (shape.responses) {
				result = shape.responses[200] || values(shape.responses)[0]
			}

			const bodyParams = (b => {
				const x = swg2param2obj([b])
				const y = <Types.ObjectOf>swg2schema2types((inBody || { schema: void 0 }).schema)
				return y
			})(inBody)
			const pathParams = swg2param2obj(inPath)
			const queryParams = swg2param2obj(inQuery)
			const resultType = [(result as {
				description: string
				schema?: Swagger2Doc.SchemaObject | { $ref: string }
			})].map(x => {
				if (x.schema && (x.schema as Swagger2Doc.SchemaObject).type) {
					const type = swg2schema2types(x.schema as Swagger2Doc.SchemaObject)
					return type
				} else {
					return new Types.Void
				}
			})[0]
			results.push({
				url: path,
				method: method,
				comment: shape.description,
				urlParams: pathParams,
				bodyParams: bodyParams,
				query: queryParams,
				result: resultType,
				name: shape.operationId,
				modifier: {
					depercated: shape.deprecated
				}
			})
		}
	}
	return results
}
/** Get other data */
export function getExtraData(obj: Swagger2Doc): ExtraData {
	//#region Interfaces
	const interfaces: ExtraData['interfaces'] = []
	for (const key in obj.definitions) {
		const type = swg2schema2types(obj.definitions[key])
		// #/definitions/ is JSON Reference Pointer (http://tools.ietf.org/html/rfc6901)
		interfaces.push({ name: key.replace('#/definitions/', ''), type })
	}
	//#endregion
	return { interfaces }
}
