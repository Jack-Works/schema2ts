import { Specs } from '../src/specifications'
import { Schema2tsServerDefinition } from '../src/api'
import API from '../src/api'

Specs.set('My API', {
    is: obj => obj.mySchema,
    /**
     * YourSpecificationType => Schema2tsServerDefinition
     * @description Implement your transformer
     */
    transformer: async content => {
        const s: Schema2tsServerDefinition = {
            baseUrl: '/',
            endpoints: [],
            enums: [],
            interfaces: [],
        }
        return s
    },
})

async function main() {
    const result = await API({ schema: { mySchema: true } })
    console.log(result)
    // ---------^ Result is here
}
main()
