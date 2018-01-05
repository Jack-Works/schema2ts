import { Generator } from './code/render'
import schema2server from './specifications/specifications'

import { readFileSync } from 'fs'
import { join } from 'path'
import { requestFile, parseJSONorYAML } from './utils'

export interface Schema2tsAPI {
    /** Custom template that used to generate code */ template?: string
    isTemplateUrl?: boolean
    /** Schema that used to generate code */ schema: any
    isSchemaUrl?: boolean
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
    if (config.isSchemaUrl) {
        schema = parseJSONorYAML(await requestFile(schema))
    }
    if (typeof schema === 'string') {
        schema = parseJSONorYAML(schema)
    }
    const internalExpressOfSchema = schema2server(schema)()
    const code = Generator(internalExpressOfSchema, template)
    return code
}
