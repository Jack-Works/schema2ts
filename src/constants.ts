import * as ts from 'typescript'
import { Any } from './code/types'
export const Export = ts.createToken(ts.SyntaxKind.ExportKeyword)
export const Extends = ts.createToken(ts.SyntaxKind.ExtendsKeyword)

export const AnyType = new Any().toTypescript()
