import { RestAPI } from '../code/server'
export interface SpecificationProvider {
    is(obj: any): boolean
    transformer(content: object): Promise<RestAPI>
}
import * as OpenApi2 from './openapi/2.0'

export const Specs = new Map<string, SpecificationProvider>([['OpenAPI 2.0', OpenApi2]])

export default function Switch(content: object): Promise<RestAPI> {
    for (const spec of Specs.values()) {
        if (spec.is(content)) {
            return spec.transformer(content)
        }
    }
    throw new TypeError('Unsolved specification type')
}
