
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
	export type Schema = (SchemaObject | SchemaArray | {
		type: 'string' | 'boolean' | 'number' | 'integer'
		description?: string

	})
	export interface SchemaObject {
		type: 'object'
		properties: {
			[key: string]: SchemaObject
		}
		description?: string
		/** required keys */required: string[]
	}
	export interface SchemaArray {
		type: 'array'
		description?: string
		items: Schema
	}
	export interface EndPoint extends Consumes {
		deprecated?: boolean
		summary?: string
		description?: string
		responses?: {
			[HTTPCode: number]: {
				description: string
				schema?: SchemaObject | { $ref: string }
			}
		}
		parameters?: {
			name: string
			in: 'query' | 'path' | 'body'
			description: string
			type: string
			required?: boolean
			enum?: string[],
			schema?: SchemaObject
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
export interface Swagger2Doc extends Swagger2Doc.MetaData, Swagger2Doc.BaseUrl, Swagger2Doc.Consumes {
	swagger: '2.0'
	paths: {
		[path: string]: Swagger2Doc.HTTPMethods
	}
	definitions?: {
		[$Refs: string]: Swagger2Doc.SchemaObject
	}
}
