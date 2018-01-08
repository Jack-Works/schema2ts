import { Server } from '../code/server'
export interface SpecificationProvider<Spec> {
    is(obj: any): obj is Spec
    transformer(content: object, filePath: string): (() => Server)
}
import * as OpenApi2 from './openapi/2.0'

export default function Switch(content: object): () => Promise<Server> {
    if (OpenApi2.is(content)) return OpenApi2.transformer(content)
    throw new TypeError('Unsolved specification type')
}
