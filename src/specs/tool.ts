import { IEndPoint, ExtraData } from '../transformer/render'
import * as Swagger2 from './swagger2'
export default function (obj: any): IEndPoint[] {
	if (Swagger2.is(obj)) {
		return Swagger2.transform(obj)
	}
	throw new TypeError('Unknown type of schema')
}

export function getExtraData(obj: any): ExtraData {
	if (Swagger2.is(obj)) {
		return Swagger2.getExtraData(obj)
	}
	throw new TypeError('Unknown type of schema')
}
