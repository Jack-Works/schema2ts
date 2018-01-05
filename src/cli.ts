#!/usr/bin/env node
import { Generator } from './code/render'
import schema2server from './specifications/specifications'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, parse } from 'path'
import * as minimist from 'minimist'
import { requestFile, parseJSONorYAML } from './utils'
import main, { Schema2tsAPI } from './api'
import { deprecate } from 'util'

const _config: {
    schema: string
    template?: string
    out?: string
    outPath?: string
    noEmit?: boolean
    declaration?: boolean
    /** That's strange */ tsx?: boolean
    [key: string]: any
} = {
    ...(minimist(process.argv.slice(2)) as any),
}
// async function main() {
//     if (config.templateUrl) config.template = await requestFile(config.templateUrl)

//     if (!config.in) {
//         throw new ReferenceError('No input file, use --in [url/file path] to provide one')
//     }
//     const api = parseJSONorYAML(await requestFile(config.in))
//     const schema = schema2server(api, config.in)()
//     const code = Generator(schema, config.template)
//     if (!config.dryrun) {
//         writeFileSync(config.out || './generated.ts', code)
//     }
// }
// main()
const deprecated = (what: string, now: string) =>
    deprecate(() => void 0, `--${what} is deprecated. Use --${now} instead.`)()
const getFileNameInTS = (base: string, name: string, dec = _config.declaration, tsx = _config.tsx) => {
    return join(base, name + (dec ? '.d' : '') + '.ts' + (tsx ? 'x' : ''))
}
async function CLIMain() {
    if (_config.in) {
        deprecated('in', 'schema')
        _config.schema = _config.in
    }
    if (_config.dryrun) {
        deprecated('dryrun', 'noEmit')
        _config.noEmit = true
    }
    if (_config.templateUrl) {
        deprecated('templateUrl', 'template')
    }
    const config: Schema2tsAPI = {
        schema: _config.schema,
        isSchemaUrl: true,
        template: _config.template,
        isTemplateUrl: true,
        declaration: _config.declaration,
    }
    const result = await main(config)
    if (_config.noEmit) {
        return
    }
    const inputName = parse(_config.schema).name
    const outputPath = _config.outPath ? getFileNameInTS(_config.outPath, inputName) : undefined
    writeFileSync(outputPath || _config.out || getFileNameInTS('./', inputName), result)
}
CLIMain()

process.on('unhandledRejection', (reason, p) => {
    throw reason
})
