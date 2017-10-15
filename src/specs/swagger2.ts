import { IEndPoint } from '../transformer/render'
import * as Types from '../transformer/types'
import { Swagger2Doc } from './swagger2.ns'
export function is(obj: any) {
	return obj.swagger == '2.0'
}

const baseTypeMap = {
	string: '', boolean: true, integer: 1
}
function swg2schema2types(x: Swagger2Doc.Schema): Types.Type {
	if (x === undefined) return new Types.Void
	const like = {}
	for (const key in x.properties) {
		like[key] = baseTypeMap[x.properties[key].type]
	}
	const type: Types.ObjectOf = Types.shape(like) as Types.ObjectOf
	type.of.forEach(y => y.jsdoc = x.properties[y.key].description)
	type.of.forEach(y => y.optional = x.required && x.required.indexOf(y.key) !== -1)
	return type
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
		] of Object.entries(obj.paths) as [string, Swagger2Doc.HTTPMethods][]) {
		for (
			const [
				/** HTTP method, like GET, POST */method,
				/** Shape of this method on this path, like shape of GET /api/books/ */shape
			] of Object.entries(shapes) as [string, Swagger2Doc.EndPoint][]) {
			/** There are 3 types of parameter
			 *  In path (/{id}), in body (POST {obj: x}), in query (GET /?x=1)
			 */
			const inPath = shape.parameters.filter(x => x.in === 'path')
			const inBody = shape.parameters.filter(x => x.in === 'body')[0]
			const inQuery = shape.parameters.filter(x => x.in === 'query')
			const result = shape.responses[200] || Object.values(shape.responses)[0]

			const bodyParams = (b => {
				const x = swg2param2obj([b])
				const y = <Types.ObjectOf>swg2schema2types((inBody || { schema: void 0 }).schema)
				console.log(x, y)
				return y
			})(inBody)
			const pathParams = swg2param2obj(inPath)
			const queryParams = swg2param2obj(inQuery)
			const resultType = [(result as {
				description: string
				schema?: Swagger2Doc.Schema | { $ref: string }
			})].map(x => {
				if (x.schema && (x.schema as Swagger2Doc.Schema).type) {
					const type = swg2schema2types(x.schema as Swagger2Doc.Schema)
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
