import * as Types from './types'
export interface IEndPoint {
	/** JSDoc comment that will be added to top of the function */comment?: string
	/** Entry point */url: string
	/** HTTP Method */method: 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch'
	/** Path Parameters */urlParams?: Types.ObjectOf
	/** Post mine of body parameters */bodyParamsType: 'json' | 'form'
	/** Body parameters (json) */bodyParams?: Types.ObjectOf
	/** Header parameters */headerParams?: Types.ObjectOf
	/** Query parameters */query?: Types.ObjectOf
	/** Return type */result?: Types.Type
	/** Code-friendly name of the function */name?: string
	/** More and more */modifier?: {
		depercated?: boolean
	}
}
export interface Server {
	/** Base URL of a server, like https://api.example.com/ */baseUrl: string,
	endpoints: IEndPoint[]
	enums: Types.EnumOf[]
	interfaces: Types.TypeReferenceType[]
}
