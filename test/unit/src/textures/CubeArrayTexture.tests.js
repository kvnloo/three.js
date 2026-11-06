import { CubeArrayTexture } from '../../../../src/textures/CubeArrayTexture.js';
import { CubeTexture } from '../../../../src/textures/CubeTexture.js';
import { Texture } from '../../../../src/textures/Texture.js';
import { RenderTarget } from '../../../../src/core/RenderTarget.js';
import { CubeReflectionMapping } from '../../../../src/constants.js';
import Textures from '../../../../src/renderers/common/Textures.js';
import WebGPUTextureUtils from '../../../../src/renderers/webgpu/utils/WebGPUTextureUtils.js';
import WGSLNodeBuilder from '../../../../src/renderers/webgpu/nodes/WGSLNodeBuilder.js';
import * as ThreeCore from '../../../../src/Three.Core.js';
import * as ThreeWebGPU from '../../../../src/Three.WebGPU.js';
import * as ThreeWebGPUNodes from '../../../../src/Three.WebGPU.Nodes.js';

function createCubes( count ) {

	return Array.from( { length: count }, () => Array.from( { length: 6 }, () => {

		const canvas = document.createElement( 'canvas' );
		canvas.width = 4;
		canvas.height = 4;
		return canvas;

	} ) );

}

export default QUnit.module( 'Textures', () => {

	QUnit.module( 'CubeArrayTexture', () => {

		QUnit.test( 'image-backed constructor and one cube', ( assert ) => {

			const cubes = createCubes( 1 );
			const texture = new CubeArrayTexture( cubes );
			const size = Textures.prototype.getSize.call( {}, texture );

			assert.ok( texture instanceof Texture, 'Texture inheritance' );
			assert.ok( texture instanceof CubeTexture, 'CubeTexture inheritance' );
			assert.strictEqual( texture.isCubeTexture, true, 'Cube sampling marker' );
			assert.strictEqual( texture.isCubeArrayTexture, true, 'Cube-array marker' );
			assert.strictEqual( texture.isArrayTexture, true, 'Default array index marker' );
			assert.strictEqual( texture.mapping, CubeReflectionMapping, 'Cube mapping' );
			assert.strictEqual( texture.flipY, false, 'Cube image orientation' );
			assert.strictEqual( texture.image, cubes, 'Retains the image arrays' );
			assert.deepEqual( [ size.width, size.height, size.depth ], [ 4, 4, 6 ], 'One cube uses six GPU layers' );

		} );

		QUnit.test( 'two image-backed cubes use twelve layers', ( assert ) => {

			const cubes = createCubes( 2 );
			const texture = new CubeArrayTexture( cubes );
			const size = Textures.prototype.getSize.call( {}, texture );

			assert.strictEqual( texture.images[ 1 ][ 5 ], cubes[ 1 ][ 5 ], 'Second cube last face' );
			assert.strictEqual( texture.image.length, 2, 'Two logical cubes' );
			assert.deepEqual( [ size.width, size.height, size.depth ], [ 4, 4, 12 ], 'Two cubes use twelve GPU layers' );

		} );

		QUnit.test( 'render-target copy preserves layer count and cube flags', ( assert ) => {

			const renderTarget = new RenderTarget( 4, 4, { depth: 12 } );
			const texture = new CubeArrayTexture().copy( renderTarget.texture );
			const size = Textures.prototype.getSize.call( {}, texture );

			assert.strictEqual( texture.isCubeTexture, true, 'Copy retains cube marker' );
			assert.strictEqual( texture.isCubeArrayTexture, true, 'Copy retains cube-array marker' );
			assert.strictEqual( texture.isArrayTexture, true, 'Copy retains array marker' );
			assert.deepEqual( [ size.width, size.height, size.depth ], [ 4, 4, 12 ], 'Render target has twelve face layers' );
			assert.strictEqual( texture.image.depth / 6, 2, 'Twelve face layers represent two cubes' );

		} );

		QUnit.test( 'reject incomplete cube face arrays', ( assert ) => {

			const faces = createCubes( 1 )[ 0 ].slice( 0, 5 );

			assert.throws( () => new CubeArrayTexture( [ faces ] ), TypeError, 'Requires six faces per cube' );
			assert.throws( () => new CubeArrayTexture( {} ), TypeError, 'Requires an array of cubes' );

		} );

		QUnit.test( 'only WebGPU source entrypoints export cube arrays', ( assert ) => {

			assert.strictEqual( 'CubeArrayTexture' in ThreeCore, false, 'Excluded from core / WebGL entrypoint' );
			assert.strictEqual( ThreeWebGPU.CubeArrayTexture, CubeArrayTexture, 'WebGPU entrypoint' );
			assert.strictEqual( ThreeWebGPUNodes.CubeArrayTexture, CubeArrayTexture, 'WebGPU Nodes entrypoint' );

		} );

		QUnit.test( 'WebGPU upload maps two cubes to twelve consecutive layers', ( assert ) => {

			const cubes = createCubes( 2 );
			const copies = [];
			const utils = new WebGPUTextureUtils( {
				device: {
					queue: {
						copyExternalImageToTexture( source, destination, size ) {

							copies.push( {
								source: source.source,
								layer: destination.origin.z,
								width: size.width,
								height: size.height
							} );

						}
					}
				}
			} );

			utils._copyCubeArrayToTexture( new CubeArrayTexture( cubes ), {}, { size: { width: 4, height: 4 } } );

			assert.strictEqual( copies.length, 12, 'Exactly twelve face transfers' );
			assert.deepEqual( copies.map( ( copy ) => copy.layer ), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ], 'Cube index times six plus face index' );
			assert.strictEqual( copies[ 0 ].source, cubes[ 0 ][ 0 ], 'First face belongs to first cube' );
			assert.strictEqual( copies[ 11 ].source, cubes[ 1 ][ 5 ], 'Final face belongs to second cube' );
			assert.deepEqual( [ copies[ 6 ].width, copies[ 6 ].height ], [ 4, 4 ], 'Preserves face dimensions' );

		} );

		QUnit.test( 'WGSL cube-array LOD sampling includes cube index', ( assert ) => {

			const builder = WGSLNodeBuilder.prototype;
			const cubeArray = new CubeArrayTexture();
			const cube = new CubeTexture();

			assert.strictEqual(
				builder.generateTextureLod( cubeArray, 'map', 'direction', 'cubeIndex', null, '0u' ),
				'textureSampleLevel( map, map_sampler, direction, cubeIndex, f32( 0u ) )',
				'Cube array supplies the cube index'
			);
			assert.strictEqual(
				builder.generateTextureLod( cube, 'map', 'direction', null, null, '0u' ),
				'textureSampleLevel( map, map_sampler, direction, f32( 0u ) )',
				'Ordinary cube sampling remains unchanged'
			);

		} );

	} );

} );
