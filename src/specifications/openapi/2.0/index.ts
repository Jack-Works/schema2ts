import * as Swagger2 from 'swagger-parser'
import * as Swagger2Spec from 'swagger-schema-official'
import { Server, IEndPoint } from '../../../code/server'
import * as Types from '../../../code/types'
import { Operation, Definition } from 'swagger2/dist/schema'
import {
    Parameter,
    QueryParameter,
    HeaderParameter,
    PathParameter,
    FormDataParameter,
    BodyParameter,
} from 'swagger-schema-official'
import { JSONSchemaToTypes, getValidVarName } from '../../../utils'

export function is(object: any): object is Swagger2Spec.Spec {
    if (object.swagger != '2.0') {
        return false
    }
    // validate isn't a sync function, so we let it go through, if validate failed, throw then
    Swagger2.validate(object).catch(reason => {
        throw reason
    })
    return true
}

const baseTypeMap: Record<any, any> = {
    string: '',
    boolean: true,
    integer: 1,
    number: 1,
}

async function main(_doc: Swagger2Spec.Spec): Promise<Server> {
    const doc: Swagger2Spec.Spec = await Swagger2.dereference(_doc)

    const baseUrl = doc.basePath
    const endpoints: IEndPoint[] = []
    const enums: Types.EnumOf[] = []
    const interfaces: Types.TypeReferenceType[] = []
    for (const pathKey in doc.paths) {
        const path = doc.paths[pathKey]
        generateEndpoint(pathKey, 'get', path.get)
        generateEndpoint(pathKey, 'post', path.post)
        generateEndpoint(pathKey, 'put', path.put)
        generateEndpoint(pathKey, 'delete', path.delete)
        generateEndpoint(pathKey, 'head', path.head)
        generateEndpoint(pathKey, 'options', path.options)
        generateEndpoint(pathKey, 'patch', path.patch)
    }
    return {
        baseUrl: baseUrl || '/',
        endpoints,
        enums,
        interfaces,
    }

    function generateEndpoint(path: string, method: keyof Swagger2Spec.Path, op?: Swagger2Spec.Operation): void {
        if (!op) return
        const JSDoc: IEndPoint['JSDoc'] = {
            depercated: op.deprecated,
            description: op.description || (op.externalDocs && op.externalDocs.description),
            summary: op.summary,
            see: op.externalDocs ? op.externalDocs.url : undefined,
            example: undefined,
        }
        // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parameterObject
        type ParametersIn = 'query' | 'header' | 'path' | 'formData' | 'body'
        type Param = IEndPoint['urlParams']
        let headerParams: Param,
            queryParams: Param,
            pathParams: Param,
            formParams: Param,
            bodyParams: IEndPoint['bodyParams']
        const result: IEndPoint['result'] = []
        if (op.parameters) {
            function fromParameter(of: ParametersIn) {
                const n = op!.parameters!.filter(x => x.in === of)
                if (n.length === 0) {
                    return undefined
                }
                return new Types.ObjectOf(
                    n.map<Types.ObjectOfWhat>(_ => {
                        // Also works with QueryParameter, HeaderParameter, PathParameter, FormDataParameter
                        const query = _ as QueryParameter
                        const schema = { ...query, required: undefined }
                        return {
                            key: query.name,
                            value: JSONSchemaToTypes(schema),
                            defaultValue: query.default,
                            jsdoc: query.description,
                        }
                    }),
                )
            }
            queryParams = fromParameter('query')
            headerParams = fromParameter('header')
            pathParams = fromParameter('path')
            formParams = fromParameter('formData')
            op.parameters.filter(x => x.in === 'body').forEach((body: BodyParameter) => {
                const t: typeof bodyParams = JSONSchemaToTypes(body.schema!)
                t.optional = !body.required
                bodyParams = t
            })
        }
        let bodyParamsType: 'json' | 'form' = 'json'
        if (op.parameters) {
            bodyParamsType = op.parameters.some(p => p.in === 'formData') ? 'form' : 'json'
        }

        if (op.responses) {
            for (const status in op.responses) {
                const num = parseInt(status, 10)
                if (status === 'default' || !isNaN(num)) {
                    const r = op.responses[status]
                    result.push([!isNaN(num) ? num : status, r.schema ? JSONSchemaToTypes(r.schema) : new Types.Any()])
                }
            }
        }

        endpoints.push({
            comment: op.description || op.summary,
            JSDoc: JSDoc,
            url: path,
            urlParams: pathParams,
            headerParams,
            queryParams,
            result,
            name: op.operationId ? getValidVarName(op.operationId) : undefined,
            bodyParamsType,
            bodyParams: bodyParamsType === 'json' ? bodyParams : formParams,
            method: method as any,
            modifier: {},
        })
    }
}
export function transformer(content: object) {
    return () => main(content as any)
}
