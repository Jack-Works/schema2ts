<h2 align="center">Schema2ts</h2>

<p align="center">
  <a href="https://travis-ci.org/Jack-Works/schema2ts">
    <img alt="Travis" src="https://img.shields.io/travis/Jack-Works/schema2ts.svg?style=flat-square">
  </a>
  <a href="https://www.npmjs.com/package/schema2ts">
    <img alt="npm version" src="https://img.shields.io/npm/v/schema2ts.svg?style=flat-square">
  </a>
  <a href="#badge">
    <img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square">
  </a>
</p>

Schema2ts is developed to generate Typescript code from REST API schema.

## Command Line usage

> Syntax: schema2ts [options][file ...]

```
Options:
    -h, --help                   Print this message.
    --template FILE/URL          Template of the generated files.
    --tsx                        Generates '.tsx' file (or .d.tsx if -d is on).
    -d, --declaration            Generates corresponding '.d.ts' file.
    -o, --out FILE               Generates file to someplace.
    --outPath DIRECTORY          Generates file to the directory.
    --noEmit                     Do not emit outputs.
```

## API Usage

```typescript
interface Schema2tsAPI {
    /** Custom template that used to generate code */ template?: string
    /** If this is true, template will be treated as url/file path */ isTemplateUrl?: boolean
    /** Schema that used to generate code */ schema: string | object
    /** If this is true, schema will be treated as url/file path */ isSchemaUrl?: boolean
    /** Generate only declarations */ declaration?: boolean
    /** If you only want to change comments on the top, you may need this. */ customFileComment?: string
    /** Code generator */ generator?: typeof RestClientGenerator
}
export default function(config: Schema2tsAPI): Promise<string>
```

### Add a custom specification

Here is an [example](./examples/example.custom.spec.ts)

```typescript
import { Specs, SpecificationProvider } from 'schema2ts/dist/specifications'
// All Specs are in this Map

import API, { Schema2tsServerDefinition } from 'schema2ts/dist/api'
// Your transformer need to return a Schema2tsServerDefinition

declare const MySpec: SpecificationProvider
Specs.set('My API', MySpec)
// Set your spec before API call
API({ schema: { mySchema: true } }).then(result => {})
```

### Utils for developers

In [`schema2ts/dist/utils.js`](./src/utils.ts), we have some utils that are useful when handle with schema objects.

**Important!**: These utils are not guaranteed to be stable, especially undocumented ones.

```typescript
/**
 * This is an impl of parsing JSON Schema into internal expression of type in schema2ts
 *
 * About JSON Schema, see: https://tools.ietf.org/html/draft-fge-json-schema-validation-00
 */
async createJSONSchemaToTypes(document: any) => (from: JSONSchema, ): Types.Type
```

In [`schema2ts/dist/code/types.js`](./src/code/types.ts), we define an internal express of Types

See [Internal type express](./src/code/types.md)

## Template variables

Variables that you can use in template comments

* %version%: Current version of schema2ts
* %typescript-version%: Current version of typescript that schema2ts use
* %when%: Current time
* %default-template%: Include default template of schema2ts

## Q&A

### Supported schema type?

* [OpenAPI 2.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md)

### Supported generator?

* [Rest Client (using axios)](./src/code/generator/rest-client.ts)
* Rest Client (using fetch) _In Future_
* Fake rest server _In Future_

_You can create your own generator!_

### What does it generate?

We have some examples in the [./examples](./examples) folder.
