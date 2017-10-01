import { JSONType, BaseType } from './transformer/json.type'
import { IEndPoint, Generator } from './transformer/iep2code'
import schema2iep from './specs/tool'

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as minimist from 'minimist'
import * as request from 'request'
const config: {
	template: string,
	in: string,
	out: string,
	templateUrl: string
} = {
		template: readFileSync(join(__dirname, '..', 'src', 'default.template.ts'), 'utf-8'),
		...minimist(process.argv.slice(2))
	}

function req<T>(url): Promise<T> {
	return new Promise((resolve, reject) => {
		request(url, (error, response, body) => {
			if (error) return reject(error)
			try {
				return resolve(JSON.parse(body))
			} catch (e) {
				return reject(e)
			}
		})
	})
}
async function main() {
	if (config.templateUrl) config.template = readFileSync(config.in, 'utf-8')
	console.log('1. Template get.')

	let api = await req(config.in)
	console.log('2. API Schema get.')

	let schema: IEndPoint[] = schema2iep(api)
	const code = Generator(schema, config.template)
	writeFileSync(config.out || './generated.ts', code)
	console.log('3. Code generated.')
}
main()

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at:', p, 'reason:', reason)
})
