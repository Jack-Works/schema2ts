import { IEndPoint } from '../transformer/iep2code'
import { is as isSwagger2, transform as swagger2 } from './swagger2'
export enum SupportedType {

}
export default function (obj: any, type?: SupportedType): IEndPoint[] {
	if (isSwagger2(obj)) {
		return swagger2(obj)
	}
	console.error('Unknown type of schema')
	return []
}
