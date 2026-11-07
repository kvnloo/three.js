import { BufferGeometry } from '../../../../../src/core/BufferGeometry.js';
import { WebGPUCoordinateSystem } from '../../../../../src/constants.js';
import * as TSL from '../../../../../src/nodes/TSL.js';
import WGSLNodeBuilder from '../../../../../src/renderers/webgpu/nodes/WGSLNodeBuilder.js';

function makeBuilder() {

	const renderer = {
		backend: {},
		coordinateSystem: WebGPUCoordinateSystem,
		debug: { diagnostics: { keywords: false } }
	};
	const builder = new WGSLNodeBuilder( { geometry: new BufferGeometry() }, renderer );
	builder.setShaderStage( 'compute' );

	return builder;

}

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'Scoped variables', () => {

		QUnit.test( 'workgroup uint array has four elements', ( assert ) => {

			const array = TSL.workgroupArray( 'uint', 4 ).setName( 'bins' );
			assert.strictEqual( array.getArrayCount(), 4, 'Four workgroup elements' );
			assert.strictEqual( array.isCacheable(), false, 'Shared memory may not be value-cached' );

			const builder = makeBuilder();
			array.generate( builder );

			assert.strictEqual(
				builder.getScopedVariables( 'compute' ),
				'var<workgroup> bins : array< u32, 4 >;',
				'Four 32-bit workgroup integers generate the expected declaration'
			);

		} );

		QUnit.test( 'workgroup uint atomic array keeps its atomic element type', ( assert ) => {

			const array = TSL.workgroupArray( 'uint', 8 ).setName( 'hist' ).toAtomic();
			assert.strictEqual( array.isAtomic, true, 'Atomic intent stays on the node' );

			const builder = makeBuilder();
			array.generate( builder );

			assert.strictEqual(
				builder.getScopedVariables( 'compute' ),
				'var<workgroup> hist : array< atomic<u32>, 8 >;',
				'Eight 32-bit atomic counters must not degrade to ordinary uints'
			);

		} );

		QUnit.test( 'private array and workgroup scalar have exact declarations', ( assert ) => {

			const scratch = TSL.privateArray( 'float', 2 ).setName( 'scratch' );
			const counter = TSL.workgroupVariable( 'uint' ).setName( 'counter' );
			assert.strictEqual( scratch.getArrayCount(), 2, 'Two private float elements' );

			const builder = makeBuilder();
			scratch.generate( builder );
			counter.generate( builder );

			assert.strictEqual(
				builder.getScopedVariables( 'compute' ),
				'var<private> scratch : array< f32, 2 >;\n' +
				'var<workgroup> counter : u32;',
				'Private 2-element f32 array and workgroup u32 scalar stay distinct'
			);

		} );

	} );

} );
