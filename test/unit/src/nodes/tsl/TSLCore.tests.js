import NodeBuilder from '../../../../../src/nodes/core/NodeBuilder.js';
import { float, ShaderNode } from '../../../../../src/Three.TSL.js';

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'TSL', () => {

		QUnit.module( 'TSLCore', () => {

			QUnit.test( 'ShaderNode proxy: raw positional arguments match iteration', ( assert ) => {

				class Holder {

					constructor( marker ) {

						this.marker = marker;

					}

				}

				for ( const [ label, argument ] of [
					[ 'plain object', { marker: 42 } ],
					[ 'class instance', new Holder( 9 ) ]
				] ) {

					let observed;

					const shader = ShaderNode( ( inputs ) => {

						observed = {
							isArray: Array.isArray( inputs ),
							atZero: inputs[ 0 ],
							iterated: [ ...inputs ][ 0 ]
						};

						return float( 0 );

					} );

					shader.call( [ argument ] ).call( new NodeBuilder() );

					assert.true( observed.isArray, label + ' retains array identity' );
					assert.strictEqual( observed.iterated, argument, label + ' iterator retains its argument' );
					assert.strictEqual( observed.atZero, argument, label + ' index zero equals iterator' );

				}

			} );

			QUnit.test( 'ShaderNode proxy: Node positional indices respect bounds', ( assert ) => {

				const argument = float( 5 );
				let atZero, atOne;

				const shader = ShaderNode( ( inputs ) => {

					atZero = inputs[ 0 ];
					atOne = inputs[ 1 ];

					return float( 0 );

				} );

				shader.call( [ argument ] ).call( new NodeBuilder() );

				assert.strictEqual( atZero, argument, 'In-bounds index retains Node identity' );
				assert.strictEqual( atOne, undefined, 'Out-of-bounds does not alias first Node' );

			} );

		} );

	} );

} );
