#!/usr/bin/env node
import { Generator } from './code/render'
import schema2server from './specifications/specifications'

import { writeFile } from 'fs'
import { join, parse } from 'path'
import * as minimist from 'minimist'
import { requestFile, parseJSONorYAML } from './utils'
import main, { Schema2tsAPI } from './api'
import { deprecate, promisify } from 'util'
import * as packageJson from '../package.json'

//#region Options
export interface Schema2tsCLI {
    schemas: string[]
    template?: string
    out?: string
    outPath?: string
    noEmit?: boolean
    declaration?: boolean
    /** That's strange */ tsx?: boolean
    help?: boolean
    customFileComment?: string
}
interface ShortForSchema2tsCLI {
    h?: Schema2tsCLI['help']
    o?: Schema2tsCLI['out']
    d?: Schema2tsCLI['declaration']
    _: string[]
}
/** Will remove in future */
export interface Schema2tsCLIDepercated {
    in?: string
    dryrun?: boolean
    templateUrl?: string
}
//#endregion

const deprecated = (what: string, now: string) =>
    deprecate(() => void 0, `--${what} is deprecated. Use --${now} instead.`)()
export const getFileNameInTS = (base: string, name: string, dec?: boolean, tsx?: boolean) => {
    return join(base, name + (dec ? '.d' : '') + '.ts' + (tsx ? 'x' : ''))
}
export default function CLIMain(_config: Schema2tsCLI & Schema2tsCLIDepercated) {
    if (_config.in) {
        deprecated('in', 'schema')
        _config.schemas = [_config.in]
    }
    if (_config.dryrun) {
        deprecated('dryrun', 'noEmit')
        _config.noEmit = true
    }
    if (_config.templateUrl) {
        deprecated('templateUrl', 'template')
    }
    _config.schemas.forEach(async file => {
        const config: Schema2tsAPI = {
            schema: file,
            isSchemaUrl: true,
            template: _config.template,
            isTemplateUrl: true,
            declaration: _config.declaration,
            customFileComment: _config.customFileComment,
        }
        const result = await main(config)
        if (_config.noEmit) {
            return
        }
        const inputName = parse(file).name
        const outputPath = _config.outPath
            ? getFileNameInTS(_config.outPath, inputName, _config.declaration, _config.tsx)
            : undefined
        await promisify(writeFile)(
            outputPath || _config.out || getFileNameInTS('./', inputName, _config.declaration, _config.tsx),
            result,
        )
    })
}

if (require.main === module) {
    const c: Schema2tsCLI & ShortForSchema2tsCLI = {
        ...(minimist(process.argv.slice(2)) as any),
    }
    if (c.h) c.help = c.h
    if (c.d) c.declaration = c.d
    if (c.o) c.out = c.o
    if (c._) c.schemas = c._
    //#region Help
    if (c.help) {
        console.log(`Schema2ts ${packageJson.version} (${packageJson.repository})
${packageJson.description}

Syntax: schema2ts [options] [file ...]

Options:
    -h, --help                   Print this message.
    --template FILE/URL          Template of the generated files.
    --tsx                        Generates '.tsx' file (or .d.tsx if -d is on).
    -d, --declaration            Generates corresponding '.d.ts' file.
    -o, --out FILE               Generates file to someplace.
    --outPath DIRECTORY          Generates file to the directory.
    --noEmit                     Do not emit outputs.
`)
    } else {
        //#endregion
        CLIMain(c)
    }
    process.on('unhandledRejection', (reason, p) => {
        throw reason
    })
}
