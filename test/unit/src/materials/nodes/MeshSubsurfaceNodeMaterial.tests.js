import MeshSubsurfaceNodeMaterial from '../../../../../src/materials/nodes/MeshSubsurfaceNodeMaterial.js';
import SSSSNode from '../../../../../examples/jsm/tsl/display/SSSSNode.js';
import { PerspectiveCamera } from '../../../../../src/cameras/PerspectiveCamera.js';
import { Texture } from '../../../../../src/textures/Texture.js';
import { texture } from 'three/tsl';

function createSSSS() {

	const imageNode = texture( new Texture() );
	return new SSSSNode( imageNode, imageNode, imageNode, new PerspectiveCamera() );

}

export default QUnit.module( 'Materials', () => {

	QUnit.module( 'MeshSubsurfaceNodeMaterial', () => {

		QUnit.test( 'packs eight per-material floats in a nonzero slot', ( assert ) => {

			const effect = createSSSS();
			const material = new MeshSubsurfaceNodeMaterial();
			material.scatteringDistanceNode.value.setRGB( 0.25, 0.5, 0.75 );
			material.strengthNode.value = 0.375;
			material.scatteringColorNode.value.setRGB( 0.5, 0.25, 0.75 );
			material.texturingModeNode.value = 1;

			effect._registerSSS( material );
			effect._syncParamsTexture();

			assert.strictEqual( material.subsurfaceSlotNode.value, 1 );
			assert.deepEqual(
				Array.from( effect._sssParamsTexture.image.data.slice( 8, 16 ) ),
				[ 0.25, 0.5, 0.75, 0.375, 0.5, 0.25, 0.75, 1 ]
			);

			effect.dispose();

		} );

		QUnit.test( 'fourth material grows texture and disposed slot is recycled', ( assert ) => {

			const effect = createSSSS();
			const materials = Array.from( { length: 4 }, () => new MeshSubsurfaceNodeMaterial() );

			for ( const material of materials ) effect._registerSSS( material );

			assert.deepEqual( materials.map( material => material.subsurfaceSlotNode.value ), [ 1, 2, 3, 4 ] );
			assert.strictEqual( effect._sssSlots.length, 5 );

			effect._growParamsTexture();

			assert.strictEqual( effect._sssCapacity, 8 );
			assert.strictEqual( effect._sssParamsTexture.image.width, 16 );
			assert.strictEqual( effect._sssParamsNode.value, effect._sssParamsTexture );

			effect._syncParamsTexture();
			assert.strictEqual( effect._sssParamsTexture.image.data[ 35 ], 1, 'slot 4 strength is at 4 * 8 + 3' );

			materials[ 1 ].dispose();
			assert.strictEqual( materials[ 1 ].subsurfaceSlotNode.value, 0 );

			const replacement = new MeshSubsurfaceNodeMaterial();
			replacement.strengthNode.value = 0.625;
			effect._registerSSS( replacement );

			assert.strictEqual( replacement.subsurfaceSlotNode.value, 2 );
			assert.strictEqual( effect._sssCapacity, 8 );

			effect._syncParamsTexture();
			assert.strictEqual( effect._sssParamsTexture.image.data[ 19 ], 0.625, 'reused slot 2 gets the new strength' );

			effect.dispose();

		} );

		QUnit.test( 'clone owns independent control uniforms and an unassigned slot', ( assert ) => {

			const effect = createSSSS();
			const original = new MeshSubsurfaceNodeMaterial();
			effect._registerSSS( original );

			const clone = original.clone();

			for ( const key of [ 'scatteringDistanceNode', 'scatteringColorNode', 'strengthNode', 'texturingModeNode', 'subsurfaceSlotNode' ] ) {

				assert.notStrictEqual( clone[ key ], original[ key ], key + ' is independently owned' );

			}

			assert.notStrictEqual( clone.scatteringDistanceNode.value, original.scatteringDistanceNode.value );
			assert.notStrictEqual( clone.scatteringColorNode.value, original.scatteringColorNode.value );
			assert.strictEqual( clone.subsurfaceSlotNode.value, 0 );

			original.strengthNode.value = 0.25;
			original.scatteringDistanceNode.value.setRGB( 0.25, 0.5, 0.75 );
			original.scatteringColorNode.value.setRGB( 0.25, 0.5, 0.75 );
			original.texturingModeNode.value = 1;

			assert.strictEqual( clone.strengthNode.value, 1 );
			assert.strictEqual( clone.scatteringDistanceNode.value.r, 0.5 );
			assert.strictEqual( clone.scatteringDistanceNode.value.g, 0.08 );
			assert.strictEqual( clone.scatteringDistanceNode.value.b, 0.03 );
			assert.strictEqual( clone.scatteringColorNode.value.r, 1 );
			assert.strictEqual( clone.texturingModeNode.value, 2 );

			effect._registerSSS( clone );

			assert.strictEqual( original.subsurfaceSlotNode.value, 1 );
			assert.strictEqual( clone.subsurfaceSlotNode.value, 2 );

			effect.dispose();

		} );

	} );

} );
