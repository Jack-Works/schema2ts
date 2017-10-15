/** From mdn.io/Object.entries */
export function entries<U, T = string>(obj: { [key: string]: U } | { [key: number]: U }): [T, U][] {
	const ownProps = Object.keys(obj)
	let i = ownProps.length
	const resArray = new Array(i) // preallocate the Array
	while (i--)
		resArray[i] = [ownProps[i], obj[ownProps[i]]]

	return resArray
}

/** From https://github.com/tc39/proposal-object-values-entries */
const reduce = Function.bind.call(Function.call, Array.prototype.reduce)
const isEnumerable = Function.bind.call(Function.call, Object.prototype.propertyIsEnumerable)
const concat = Function.bind.call(Function.call, Array.prototype.concat)
export function values<T>(O: { [key: string]: T } | { [key: number]: T }): T[] {
	return reduce(Object.keys(O), (v, k) => concat(v, typeof k === 'string' && isEnumerable(O, k) ? [O[k]] : []), [])
}

