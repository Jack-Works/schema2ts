import * as Swagger2 from 'swagger2'
export function is(object: any): object is Swagger2.Document {
	return object.swagger == '2.0'
}
export function transformer() {

}
