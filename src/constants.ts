import * as ts from 'typescript'
import * as Types from './code/types'

export const Export = ts.createToken(ts.SyntaxKind.ExportKeyword)
export const Extends = ts.createToken(ts.SyntaxKind.ExtendsKeyword)
export const AnyType = new Types.Any().toTypescript()
