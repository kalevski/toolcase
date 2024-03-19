import { State } from '@toolcase/base'

class StateExample {

    state = new State({})

    run() {
        this.state.on('state', (value) => console.log('changed to', value))
        console.log(JSON.stringify(this.state.get()))
        console.log('==== update 1 ====')
        this.state.set({
            array1: [2],
            array2: { test: 1 }
        })
        console.log('==== update 2 ====')
        this.state.set({
            array2: undefined
        })
        console.log('==== update 3 ====')
        this.state.set({
            array2: [ 1, 2, 3 ]
        })
        console.log('==== update 4 ====')
        this.state.set({
            testObject: { testA: { childA: 1 }, testB: { childB: [ 1, 2 ] } }
        })
        console.log('==== update 5 ====')
        this.state.set({
            testObject: { testA: { childA: 2 } }
        })

        this.state.empty()
        console.log(JSON.stringify(this.state.get()))
    }

}

export default StateExample