import { State } from '@toolcase/base'

class StateExample {

    state = new State({
        array1: [2, 3, 4],
        array2: ['10', '11', '21']
    })

    run() {
        console.log(JSON.stringify(this.state.get()))
        this.state.set({
            array1: [2]
        })
        console.log(JSON.stringify(this.state.get()))
    }

}

export default StateExample