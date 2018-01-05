import { Generator } from './code/render'
import schema2server from './specifications/specifications'

import { readFileSync } from 'fs'
import { join } from 'path'
import { requestFile, parseJSONorYAML } from './utils'

export interface Schema2tsAPI {
    /** Custom template that used to generate code */ template?: string
    /** If this is true, template will be treated as url/file path */ isTemplateUrl?: boolean
    /** Schema that used to generate code */ schema: string | object
    /** If this is true, schema will be treated as url/file path */ isSchemaUrl?: boolean
    /** Generate only declarations
     * TODO: Not implemented yet. */ declaration?: boolean
    /** If you only want to change comments on the top, you may need this.
     * TODO: Not implemented yet. */ customCommentsOnTheTop?: string
}

const defaultTemplate = join(__dirname, '..', 'src', 'default.template.ts')
export default async function({
    isTemplateUrl,
    template = isTemplateUrl ? defaultTemplate : readFileSync(defaultTemplate, 'utf-8'),
    schema,
    ...config
}: Schema2tsAPI) {
    if (isTemplateUrl) {
        template = await requestFile(template)
    }
    if (!schema) {
        throw new ReferenceError('No input file, use --schema [url/file path] to provide one')
    }
    if (config.isSchemaUrl && typeof schema === 'string') {
        schema = parseJSONorYAML(await requestFile(schema))
    }
    if (typeof schema === 'string') {
        schema = parseJSONorYAML(schema)
    }
    const internalExpressOfSchema = schema2server(schema as object)()
    const code = Generator(internalExpressOfSchema, template)
    return code
}
