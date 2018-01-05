import cli, { Schema2tsCLI } from '../src/cli'
const OpenAPI2 = [
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/yaml/api-with-examples.yaml',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/json/petstore-expanded.json',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/yaml/petstore-minimal.yaml',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/json/petstore-simple.json',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/yaml/petstore-with-external-docs.yaml',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/json/petstore.json',
    'https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/yaml/uber.yaml',
]
function run(urls: string[], path: string) {
    try {
        const config: Schema2tsCLI = {
            schemas: urls,
            outPath: __dirname + '/' + path,
        }
        cli(config)
    } catch (e) {
        console.error(e)
    }
}
run(OpenAPI2, 'OpenAPI-2.0')
