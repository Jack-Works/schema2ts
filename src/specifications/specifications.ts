export interface SpecificationProvider<Spec> {
	is(obj: any): obj is Spec
	transformer()
}
import * as Swagger2 from './swagger2'

export default function (content: object, filePath: string): SpecificationProvider<any>['transformer'] {
	if (Swagger2.is(content)) return Swagger2.transformer
	throw new TypeError('Unsolved specification type.')
}
