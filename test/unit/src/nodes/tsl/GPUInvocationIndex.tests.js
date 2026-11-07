import * as TSL from '../../../../../src/nodes/TSL.js';
import IndexNode from '../../../../../src/nodes/core/IndexNode.js';
import WGSLNodeBuilder from '../../../../../src/renderers/webgpu/nodes/WGSLNodeBuilder.js';
import { rawComputeTest, readUintBuffer } from './gpu-raw-test-utils.js';

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'TSL', () => {

		QUnit.module( 'invocationIndex', () => {

			QUnit.test( 'global invocation scope is defined and exported', ( assert ) => {

				assert.strictEqual( IndexNode.INVOCATION_GLOBAL, 'invocationGlobal' );
				assert.strictEqual( TSL.invocationIndex?.scope, 'invocationGlobal' );
				assert.strictEqual( TSL.instanceIndex.scope, 'instance' );

			} );

			QUnit.test( 'compute index remains available to existing TSL callers', ( assert ) => {

				const builder = Object.create( WGSLNodeBuilder.prototype );
				builder.shaderStage = 'compute';

				assert.strictEqual( builder.getInstanceIndex(), 'instanceIndex' );
				assert.strictEqual( builder.getInvocationIndex(), 'invocationIndex' );

			} );

			rawComputeTest( 'global invocation index flattens a 3D dispatch', {}, async ( { assert, renderer } ) => {

				const xOut = TSL.instancedArray( 96, 'uint' );
				const yOut = TSL.instancedArray( 96, 'uint' );
				const zOut = TSL.instancedArray( 96, 'uint' );

				const kernel = TSL.Fn( () => {

					xOut.element( TSL.invocationIndex ).assign( TSL.globalId.x );
					yOut.element( TSL.invocationIndex ).assign( TSL.globalId.y );
					zOut.element( TSL.invocationIndex ).assign( TSL.globalId.z );

				} )().compute( [ 2, 3, 2 ], [ 4, 2, 1 ] );

				await renderer.computeAsync( kernel );

				const xs = await readUintBuffer( renderer, xOut );
				const ys = await readUintBuffer( renderer, yOut );
				const zs = await readUintBuffer( renderer, zOut );

				for ( let z = 0; z < 2; z ++ ) {

					for ( let y = 0; y < 6; y ++ ) {

						for ( let x = 0; x < 8; x ++ ) {

							const slot = x + 8 * y + 48 * z;
							assert.strictEqual( xs[ slot ], x, 'slot ' + slot + ': x' );
							assert.strictEqual( ys[ slot ], y, 'slot ' + slot + ': y' );
							assert.strictEqual( zs[ slot ], z, 'slot ' + slot + ': z' );

						}

					}

				}

			} );

		} );

	} );

} );
