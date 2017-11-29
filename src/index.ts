#!/usr/bin/env node
import { Generator } from './code/render'
import schema2server from './specifications/specifications'
import * as yaml from 'yamljs'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as minimist from 'minimist'
import * as request from 'request'
const config: {
	template: string,
	in: string,
	out: string,
	templateUrl: string,
	dryrun: boolean
} = {
		template: readFileSync(join(__dirname, '..', 'src', 'default.template.ts'), 'utf-8'),
		dryrun: false,
		...minimist(process.argv.slice(2)),
	}
if (!config.in) {
	throw new SyntaxError('No input. Use --in= to set one.')
}
function req<T>(url, raw?): Promise<T> {
	if (existsSync(url)) {
		return Promise.resolve(
			(x => {
				if (raw) { return x as any }
				try {
					return JSON.parse(x)
				} catch {
					try {
						return yaml.parse(x)
					} catch {
						throw new TypeError('Input file is not JSON nor Yaml')
					}
				}
			})(readFileSync(url, 'utf-8'))
		)
	}
	return new Promise((resolve, reject) => {
		request(url, (error, response, body) => {
			if (error) return reject(error)
			try {
				if (raw) resolve(body)
				return resolve(JSON.parse(body))
			} catch (e) {
				return reject(e)
			}
		})
	})
}
async function main() {
	if (config.templateUrl) config.template = await req<string>(config.templateUrl, true)
	console.log('1. Template get.')

	const api = await req(config.in)
	console.log('2. API Schema get.')

	const schema = schema2server(api, config.in)()
	const code = Generator(schema, config.template)
	if (!config.dryrun) { writeFileSync(config.out || './generated.ts', code) }
	console.log('3. Code generated.')
}
main()

process.on('unhandledRejection', (reason, p) => {
	throw reason
})
