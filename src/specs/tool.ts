import { IEndPoint } from '../transformer/render'
import { is as isSwagger2, transform as swagger2 } from './swagger2'
export default function (obj: any): IEndPoint[] {
	if (isSwagger2(obj)) {
		return swagger2(obj)
	}
	throw new TypeError('Unknown type of schema')
}
