import NodeBuilder from '../../../../../src/nodes/core/NodeBuilder.js';
import Node from '../../../../../src/nodes/core/Node.js';

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'NodeBuilder', () => {

		QUnit.test( 'unregistered inherited hash keys are misses', ( assert ) => {

			const builder = new NodeBuilder();

			assert.strictEqual( builder.getNodeFromHash( 'toString' ), undefined );
			assert.strictEqual( builder.getNodeFromHash( 'constructor' ), undefined );
			assert.strictEqual( builder.getNodeFromHash( '__proto__' ), undefined );

		} );

		QUnit.test( 'numeric and string hashes resolve registered nodes', ( assert ) => {

			const builder = new NodeBuilder();
			const node = new Node();

			builder.setHashNode( node, 17 );

			assert.strictEqual( builder.getNodeFromHash( 17 ), node );
			assert.strictEqual( builder.getNodeFromHash( 18 ), undefined );
			assert.strictEqual( typeof node.getHash( builder ), 'string' );

			const shared = new Node();
			shared.getHash = () => 'shared-node';
			builder.addNode( shared );

			assert.strictEqual( builder.getNodeFromHash( 'shared-node' ), shared );

			const equivalent = new Node();
			equivalent.getHash = () => 'shared-node';

			assert.strictEqual( equivalent.getShared( builder ), shared );

		} );

		QUnit.test( 'special-key registration does not pollute other lookups', ( assert ) => {

			const builder = new NodeBuilder();
			const node = new Node();

			builder.setHashNode( node, '__proto__' );

			assert.strictEqual( builder.getNodeFromHash( '__proto__' ), node );
			assert.strictEqual( builder.getNodeFromHash( 'constructor' ), undefined );

		} );

		QUnit.test( 'node data retains all shader stage slots', ( assert ) => {

			const builder = new NodeBuilder();
			const node = new Node();
			const vertexData = builder.getDataFromNode( node, 'vertex' );
			const nodeData = builder.cache.getData( node );

			assert.deepEqual( Object.keys( nodeData ), [ 'vertex', 'fragment', 'compute', 'any' ] );
			assert.strictEqual( nodeData.vertex, vertexData );
			assert.strictEqual( nodeData.fragment, undefined );
			assert.strictEqual( builder.getDataFromNode( node, 'vertex' ), vertexData );

			const fragmentData = builder.getDataFromNode( node, 'fragment' );

			assert.notStrictEqual( fragmentData, vertexData );
			assert.strictEqual( builder.cache.getData( node ), nodeData );

			const otherNode = new Node();
			builder.getDataFromNode( otherNode, 'fragment' );

			assert.deepEqual( Object.keys( builder.cache.getData( otherNode ) ), Object.keys( nodeData ) );

		} );

	} );

} );
