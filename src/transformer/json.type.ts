export type JSONType = Property | ArrayOf | {
	_type: BaseType
}
export enum BaseType {
	number = 'number',
	null = 'null',
	string = 'string',
	boolean = 'boolean',
}
export interface ArrayOf { of: JSONType, _type: 'array' }
export interface Property {
	_type: 'object'
	key: string
	type: JSONType
	comment?: string
	optional?: boolean
}
