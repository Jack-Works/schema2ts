<h2 align="center">Schema2ts</h2>

<p align="center">
  <a href="https://travis-ci.org/Jack-Works/schema2tscode">
    <img alt="Travis" src="https://img.shields.io/travis/Jack-Works/schema2tscode.svg?style=flat-square">
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
export default function(config: Schema2tsAPI): Promise<string>
```

## Q&A

### Supported schema type?

* [OpenAPI 2.0](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md)

### What does it generate?

We have some examples in the [./examples](./examples) folder.
