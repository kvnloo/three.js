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


	} );

} );
