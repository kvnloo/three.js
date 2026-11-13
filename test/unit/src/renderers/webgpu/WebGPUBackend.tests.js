import { RenderTarget } from '../../../../../src/core/RenderTarget.js';
import { BoxGeometry } from '../../../../../src/geometries/BoxGeometry.js';
import { MeshBasicMaterial } from '../../../../../src/materials/MeshBasicMaterial.js';
import { Mesh } from '../../../../../src/objects/Mesh.js';
import RenderContext from '../../../../../src/renderers/common/RenderContext.js';
import WebGPUBackend from '../../../../../src/renderers/webgpu/WebGPUBackend.js';

function createMRTFixture( formats ) {

	const backend = new WebGPUBackend();
	const target = new RenderTarget( 2, 2, { count: formats.length, depthBuffer: false } );
	const geometry = new BoxGeometry();
	const material = new MeshBasicMaterial();
	const object = new Mesh( geometry, material );
	const context = new RenderContext();

	context.textures = target.textures;
	context.depth = false;
	context.stencil = false;
	context.sampleCount = 1;

	for ( let i = 0; i < formats.length; i ++ ) {

		backend.get( target.textures[ i ] ).format = formats[ i ];

	}

	const renderObject = {
		object,
		geometry,
		material,
		context,
		geometryVersion: 0,
		clippingContextCacheKey: '',
		getAttributes() {

			return [ geometry.getAttribute( 'position' ) ];

		}
	};

	return { backend, target, geometry, material, renderObject };

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGPUBackend', () => {

		QUnit.test( 'needsRenderUpdate invalidates on later MRT attachment changes', ( assert ) => {

			const { backend, target, geometry, material, renderObject } = createMRTFixture( [ 'rgba16float', 'rgba8unorm', 'rg16float' ] );

			assert.true( backend.needsRenderUpdate( renderObject ), 'initial pipeline state must be recorded' );
			assert.false( backend.needsRenderUpdate( renderObject ), 'unchanged attachment formats keep the pipeline' );

			backend.get( target.textures[ 1 ] ).format = 'rg16float';

			assert.true( backend.needsRenderUpdate( renderObject ), 'attachment 1 format invalidates the pipeline' );
			assert.false( backend.needsRenderUpdate( renderObject ), 'updated attachment 1 is stable' );

			backend.get( target.textures[ 2 ] ).format = 'rg16snorm';

			assert.true( backend.needsRenderUpdate( renderObject ), 'attachment 2 format invalidates the pipeline' );
			assert.false( backend.needsRenderUpdate( renderObject ), 'updated attachment 2 is stable' );
			assert.strictEqual( backend.get( renderObject ).colorFormat, 'rgba16float,rg16float,rg16snorm', 'stored state tracks every attachment in order' );

			target.dispose();
			geometry.dispose();
			material.dispose();

		} );

		QUnit.test( 'getRenderCacheKey distinguishes two-attachment MRT pipelines', ( assert ) => {

			const { backend, target, geometry, material, renderObject } = createMRTFixture( [ 'rgba16float', 'rgba8unorm' ] );

			const first = backend.getRenderCacheKey( renderObject );

			assert.ok( first.includes( 'rgba16float,rgba8unorm' ), 'both attachment formats are in the pipeline key' );
			assert.strictEqual( backend.getRenderCacheKey( renderObject ), first, 'unchanged pipeline has an identical key' );

			backend.get( target.textures[ 1 ] ).format = 'rg16float';

			const second = backend.getRenderCacheKey( renderObject );

			assert.notStrictEqual( second, first, 'changing only attachment 1 changes the pipeline key' );
			assert.ok( second.includes( 'rgba16float,rg16float' ), 'new attachment 1 format is included' );
			assert.strictEqual( backend.getRenderCacheKey( renderObject ), second, 'updated pipeline key is stable' );

			backend.get( target.textures[ 0 ] ).format = 'rgba8unorm';

			const third = backend.getRenderCacheKey( renderObject );

			assert.notStrictEqual( third, second, 'changing attachment 0 also changes the pipeline key' );
			assert.ok( third.includes( 'rgba8unorm,rg16float' ), 'format order is preserved' );

			target.dispose();
			geometry.dispose();
			material.dispose();

		} );

	} );

} );
