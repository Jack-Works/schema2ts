#!/usr/bin/env node
import { Generator } from './code/render'
import schema2server from './specifications/specifications'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as minimist from 'minimist'
import { requestFile, parseJSONorYAML } from './utils'
const config: {
    template: string
    in?: string
    out?: string
    templateUrl?: string
    dryrun: boolean
    [key: string]: any
} = {
    template: readFileSync(join(__dirname, '..', 'src', 'default.template.ts'), 'utf-8'),
    dryrun: false,
    ...minimist(process.argv.slice(2)),
}
async function main() {
    if (config.templateUrl) config.template = await requestFile(config.templateUrl)

    if (!config.in) {
        throw new ReferenceError('No input file, use --in [url/file path] to provide one')
    }
    const api = parseJSONorYAML(await requestFile(config.in))
    const schema = schema2server(api, config.in)()
    const code = Generator(schema, config.template)
    if (!config.dryrun) {
        writeFileSync(config.out || './generated.ts', code)
    }
}
main()

process.on('unhandledRejection', (reason, p) => {
    throw reason
})
