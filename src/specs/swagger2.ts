import { IEndPoint } from '../transformer/iep2code'
import { Property, ArrayOf, BaseType, JSONType } from '../transformer/json.type'
export namespace Swagger2Doc {
	export interface MetaData {
		info: {
			title: string
			description?: string
			version: string
		}
	}
	export interface BaseUrl {
		host: string
		basePath: string
		schemes: ('http' | 'https' | 'ws' | 'wss')[]
	}
	export interface Consumes {
		consumes?: string[]
		produces?: string[]
	}
	export interface Schema {
		type: 'object'
		properties: {
			[key: string]: {
				type: string
				description: string
			}
		}
	}
	export interface EndPoint extends Consumes {
		deprecated?: boolean
		summary?: string
		description?: string
		responses: {
			[HTTPCode: number]: {
				description: string
				schema?: Schema | { $ref: string }
			}
		}
		parameters: {
			name: string
			in: 'query' | 'path'
			description: string
			type: string
			required?: boolean
			enum?: string[]
		}[]
		operationId: string
		tags: string[]
		externalDocs?: {
			url: string
			description: string
		}
	}
	export interface HTTPMethods {
		get?: Swagger2Doc.EndPoint
		post?: Swagger2Doc.EndPoint
		put?: Swagger2Doc.EndPoint
		patch?: Swagger2Doc.EndPoint
		delete?: Swagger2Doc.EndPoint
		head?: Swagger2Doc.EndPoint
		options?: Swagger2Doc.EndPoint
	}
}
export interface Swagger2Doc extends
	Swagger2Doc.MetaData, Swagger2Doc.BaseUrl, Swagger2Doc.Consumes {
	swagger: '2.0'
	paths: {
		[path: string]: Swagger2Doc.HTTPMethods
	}
	definitions?: {
		[$Refs: string]: Swagger2Doc.Schema
	}
}
export function is(obj: any) {
	return obj.swagger == '2.0'
}
function getTypeLit(type: string): { _type: BaseType | 'object' | 'array' } {
	if (type === 'integer') return { _type: BaseType.number }
	if (type == 'undefined') return { _type: BaseType.string }
	return { _type: BaseType.string }
}
function getType(obj: Swagger2Doc.Schema = { type: 'object', properties: {} }): Property[] {
	return Object.keys(obj.properties).map(x => {
		let item = obj.properties[x]
		return {
			key: x,
			comment: item.description,
			type: { _type: x },
			_type: 'object'
		} as Property
	})
}
function transfParam(def: Swagger2Doc.EndPoint): Property[] {
	return def.parameters.map(x => {
		return {
			key: x.name,
			comment: x.description,
			type: getTypeLit(x.type) as any,
			_type: 'object',
			optional: !x.required
		} as Property
	})
}

export function transform(obj: Swagger2Doc): IEndPoint[] {
	let results: IEndPoint[] = []
	for (let [path, methods] of Object.entries(obj.paths) as [string, Swagger2Doc.HTTPMethods][]) {
		for (let [method, def] of Object.entries(methods) as [string, Swagger2Doc.EndPoint][]) {
			let schema = ((Object.entries(def.responses) as [string, {
				description: string
				schema?: Swagger2Doc.Schema
			}][])
				.filter(([x, y]) => y.schema)[0] || ['', {
					description: '',
					schema: {
						type: 'object',
						properties: {}
					}
				}])[1].schema
			let ep: IEndPoint = {
				url: path,
				method: method.toUpperCase() as any,
				params: transfParam(def),
				result: getType(schema),
				name: def.operationId,
				comment: def.description
			}
			results.push(ep)
		}
	}
	return results
}
