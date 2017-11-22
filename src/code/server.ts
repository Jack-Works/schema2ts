import * as Types from './types'
export interface IEndPoint {
	/** JSDoc comment that will be added to top of the function */comment?: string
	/** Entry point */url: string
	/** HTTP Method */method: 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch'
	/** Path Parameters */urlParams?: Types.ObjectOf | Types.TypeReferenceType
	/** Post mine of body parameters */bodyParamsType: 'json' | 'form'
	/** Body parameters (json) */bodyParams?: Types.ObjectOf | Types.TypeReferenceType
	/** Header parameters */headerParams?: Types.ObjectOf | Types.TypeReferenceType
	/** Query parameters */query?: Types.ObjectOf | Types.TypeReferenceType
	/** Return type */result?: [number, Types.Type][]
	/** Code-friendly name of the function */name?: string
	/** More and more */modifier?: {
		depercated?: boolean
	}
}
export interface Server {
	/** Base URL of a server, like https://api.example.com/ */baseUrl: string,
	endpoints: IEndPoint[]
	/** 
	 * This [] is used to put enums that does not used directly by endpoints
	 * ALL enums referenced by Types.TypeReferenceType will be auto injected into output
	 */
	enums: Types.EnumOf[]
	/** 
	 * This [] is used to put interface that does not used directly by endpoints
	 * ALL interfaces referenced by Types.TypeReferenceType will be auto injected into output
	 */
	interfaces: Types.TypeReferenceType[]
}
