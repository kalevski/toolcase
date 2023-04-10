import { AdjacencyMatrix } from '@toolcase/base'

class AdjMatrixExample {

    run() {
        let matrix = new AdjacencyMatrix('good', 'bad')
        matrix.addVertex('person1')
        matrix.addVertex('person2')
        matrix.addVertex('person3')
        matrix.addVertex('person4')

        matrix.addEdge('person1', 'person2')
        matrix.addEdge('person1', 'person3')
        matrix.addEdge('person1', 'person4')

        matrix.addEdge('person2', 'person3')
        matrix.addEdge('person2', 'person4')

        matrix.addEdge('person3', 'person4')

        console.log(matrix.getEdges('person2'))

    }

}

export default AdjMatrixExample