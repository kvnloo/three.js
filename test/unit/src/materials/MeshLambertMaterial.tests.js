import { MeshLambertMaterial } from '../../../../src/materials/MeshLambertMaterial.js';

import { Material } from '../../../../src/materials/Material.js';

import { Mesh } from '../../../../src/objects/Mesh.js';
import { PlaneGeometry } from '../../../../src/geometries/PlaneGeometry.js';
import { PerspectiveCamera } from '../../../../src/cameras/PerspectiveCamera.js';
import { Scene } from '../../../../src/scenes/Scene.js';
import { Texture } from '../../../../src/textures/Texture.js';
import LightsNode from '../../../../src/nodes/lighting/LightsNode.js';
import WebGPURenderer from '../../../../src/renderers/webgpu/WebGPURenderer.js';
import RenderObject from '../../../../src/renderers/common/RenderObject.js';
import RenderContext from '../../../../src/renderers/common/RenderContext.js';
import NodeManager from '../../../../src/renderers/common/nodes/NodeManager.js';

export default QUnit.module( 'Materials', () => {

	QUnit.module( 'MeshLambertMaterial', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const object = new MeshLambertMaterial();
			assert.strictEqual(
				object instanceof Material, true,
				'MeshLambertMaterial extends from Material'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const object = new MeshLambertMaterial();
			assert.ok( object, 'Can instantiate a MeshLambertMaterial.' );

		} );

		// PROPERTIES
		QUnit.test( 'type', ( assert ) => {

			const object = new MeshLambertMaterial();
			assert.ok(
				object.type === 'MeshLambertMaterial',
				'MeshLambertMaterial.type should be MeshLambertMaterial'
			);

		} );

		// PUBLIC
		QUnit.test( 'isMeshLambertMaterial', ( assert ) => {

			const object = new MeshLambertMaterial();
			assert.ok(
				object.isMeshLambertMaterial,
				'MeshLambertMaterial.isMeshLambertMaterial should be true'
			);

		} );

		// WEBGPU SHADER CACHE REGRESSION
		QUnit.test( 'WebGPU program layout is independent of map/emissiveMap aliasing (#35389)', ( assert ) => {

			const sharedTexture = new Texture();
			const mapTexture = new Texture();
			const emissiveTexture = new Texture();

			const aliasedMaterial = new MeshLambertMaterial( {
				map: sharedTexture,
				emissiveMap: sharedTexture,
				emissive: 0xffffff
			} );

			const distinctMaterial = new MeshLambertMaterial( {
				map: mapTexture,
				emissiveMap: emissiveTexture,
				emissive: 0xffffff
			} );

			const renderer = new WebGPURenderer();
			const nodes = new NodeManager( renderer, renderer.backend );
			const scene = new Scene();
			const camera = new PerspectiveCamera();
			const lightsNode = new LightsNode();
			const renderContext = new RenderContext();
			const geometry = new PlaneGeometry();

			const aliasedRenderObject = new RenderObject(
				nodes, null, renderer, new Mesh( geometry, aliasedMaterial ),
				aliasedMaterial, scene, camera, lightsNode, renderContext, null
			);
			const distinctRenderObject = new RenderObject(
				nodes, null, renderer, new Mesh( geometry, distinctMaterial ),
				distinctMaterial, scene, camera, lightsNode, renderContext, null
			);

			assert.strictEqual(
				aliasedRenderObject.getMaterialCacheKey(),
				distinctRenderObject.getMaterialCacheKey(),
				'Texture identity is not part of the structural material cache key.'
			);

			const aliasedState = aliasedRenderObject.getNodeBuilderState();
			const reusedState = distinctRenderObject.getNodeBuilderState();

			assert.strictEqual(
				aliasedState, reusedState,
				'The second render object reuses the first material\'s compiled node program state.'
			);

			// Compile the same second material against an empty node cache to expose
			// whether texture-object aliasing changes the generated shader layout.
			const isolatedNodes = new NodeManager( renderer, renderer.backend );
			const isolatedRenderObject = new RenderObject(
				isolatedNodes, null, renderer, new Mesh( geometry, distinctMaterial ),
				distinctMaterial, scene, camera, lightsNode, renderContext, null
			);
			const independentlyBuiltState = isolatedRenderObject.getNodeBuilderState();

			assert.strictEqual(
				aliasedState.fragmentShader, independentlyBuiltState.fragmentShader,
				'Structurally identical materials must use the same shader layout, regardless of texture aliasing.'
			);

		} );



		// WEBGPU / WEBGL FALLBACK TEXTURE-NODE BINDING MATRIX
		// Texture slots must keep a structural shader layout regardless of whether
		// their values reference the same Texture instance or two different ones.
		for ( const { label, forceWebGL } of [
			{ label: 'WebGPU', forceWebGL: false },
			{ label: 'WebGL fallback', forceWebGL: true }
		] ) {

			for ( const aliasedFirst of [ true, false ] ) {

				QUnit.test( `texture-node binding matrix (#35389): ${ label }, ${ aliasedFirst ? 'aliased first' : 'distinct first' }`, ( assert ) => {

					const sharedTexture = new Texture();
					const mapTexture = new Texture();
					const emissiveTexture = new Texture();
					const fixtureTextures = [ sharedTexture, mapTexture, emissiveTexture ];

					const aliasedMaterial = new MeshLambertMaterial( {
						map: sharedTexture,
						emissiveMap: sharedTexture,
						emissive: 0xffffff
					} );
					const distinctMaterial = new MeshLambertMaterial( {
						map: mapTexture,
						emissiveMap: emissiveTexture,
						emissive: 0xffffff
					} );

					const renderer = new WebGPURenderer( { forceWebGL } );
					const scene = new Scene();
					const camera = new PerspectiveCamera();
					const lightsNode = new LightsNode();
					const renderContext = new RenderContext();
					const geometry = new PlaneGeometry();

					function createRenderObject( nodes, material ) {

						return new RenderObject(
							nodes, null, renderer, new Mesh( geometry, material ),
							material, scene, camera, lightsNode, renderContext, null
						);

					}

					function fixtureTextureBindingCount( state ) {

						return state.bindings.flatMap( ( group ) => group.bindings ).filter( ( binding ) => (
							binding.isSampledTexture === true && fixtureTextures.includes( binding.texture )
						) ).length;

					}

					// Independent builders expose the expected shader and binding
					// layout for each material, without a prior cache hit.
					const isolatedAliasedState = createRenderObject(
						new NodeManager( renderer, renderer.backend ), aliasedMaterial
					).getNodeBuilderState();
					const isolatedDistinctState = createRenderObject(
						new NodeManager( renderer, renderer.backend ), distinctMaterial
					).getNodeBuilderState();

					assert.strictEqual(
						isolatedAliasedState.fragmentShader, isolatedDistinctState.fragmentShader,
						'The independently built shaders must be structurally identical.'
					);
					assert.strictEqual(
						fixtureTextureBindingCount( isolatedAliasedState ), 2,
						'Two material texture slots require two sampled-texture binding positions, even when aliased.'
					);
					assert.strictEqual(
						fixtureTextureBindingCount( isolatedDistinctState ), 2,
						'Two distinct texture slots require two sampled-texture binding positions.'
					);

					// A single NodeManager caches the first builder state for the
					// second material, in both possible compilation orders.
					const sharedNodes = new NodeManager( renderer, renderer.backend );
					const firstMaterial = aliasedFirst ? aliasedMaterial : distinctMaterial;
					const secondMaterial = aliasedFirst ? distinctMaterial : aliasedMaterial;
					const firstRenderObject = createRenderObject( sharedNodes, firstMaterial );
					const secondRenderObject = createRenderObject( sharedNodes, secondMaterial );

					assert.strictEqual(
						firstRenderObject.getMaterialCacheKey(), secondRenderObject.getMaterialCacheKey(),
						'Material cache keys remain equal for structurally identical materials.'
					);

					const firstState = firstRenderObject.getNodeBuilderState();
					const reusedState = secondRenderObject.getNodeBuilderState();
					const isolatedSecondState = aliasedFirst ? isolatedDistinctState : isolatedAliasedState;

					assert.strictEqual(
						reusedState, firstState,
						'The second material reuses the first material node builder state.'
					);
					assert.strictEqual(
						reusedState.fragmentShader, isolatedSecondState.fragmentShader,
						'The reused shader must agree with an independent compile of the second material.'
					);
					assert.strictEqual(
						fixtureTextureBindingCount( reusedState ),
						fixtureTextureBindingCount( isolatedSecondState ),
						'The reused sampled-texture binding count must agree with the independent second material.'
					);

				} );

			}

		}

	} );

} );
