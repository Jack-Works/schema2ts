import { Server } from '../code/server'
export interface SpecificationProvider<Spec> {
	is(obj: any): obj is Spec
	transformer(content: object, filePath: string): (() => Server)
}
import * as Swagger2 from './swagger2'

export default function Switch(content: object, filePath: string): () => Server {
	if (Swagger2.is(content)) return Swagger2.transformer(content, filePath)
	throw new TypeError('Unsolved specification type.')
}
