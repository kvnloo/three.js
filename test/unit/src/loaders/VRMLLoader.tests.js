import { VRMLLoader } from '../../../../examples/jsm/loaders/VRMLLoader.js';

export default QUnit.module( 'Loaders', () => {

	QUnit.module( 'VRMLLoader', () => {

		function parseCamera( type, position ) {

			const source = `#VRML V2.0 utf8\n${type} { position ${position.join( ' ' )} }\n`;
			const scene = new VRMLLoader().parse( source, '' );

			return scene.children;

		}

		QUnit.test( 'PerspectiveCamera preserves independent z', ( assert ) => {

			const children = parseCamera( 'PerspectiveCamera', [ - 8.6, 2.1, 5.6 ] );
			assert.strictEqual( children.length, 1, 'One camera parsed' );
			assert.strictEqual( children[ 0 ].type, 'PerspectiveCamera', 'Correct camera type' );
			assert.deepEqual( children[ 0 ].position.toArray(), [ - 8.6, 2.1, 5.6 ], 'x, y, z kept independently' );

		} );

		QUnit.test( 'OrthographicCamera preserves negative z', ( assert ) => {

			const children = parseCamera( 'OrthographicCamera', [ 8.6, 2.1, - 5.6 ] );
			assert.strictEqual( children.length, 1, 'One camera parsed' );
			assert.strictEqual( children[ 0 ].type, 'OrthographicCamera', 'Correct camera type' );
			assert.deepEqual( children[ 0 ].position.toArray(), [ 8.6, 2.1, - 5.6 ], 'Negative z kept independently' );

		} );

		QUnit.test( 'Equal x and z remains unchanged', ( assert ) => {

			const children = parseCamera( 'PerspectiveCamera', [ 4, 5, 4 ] );
			assert.strictEqual( children.length, 1, 'One camera parsed' );
			assert.deepEqual( children[ 0 ].position.toArray(), [ 4, 5, 4 ], 'Equal coordinates remain unchanged' );

		} );

	} );

} );
