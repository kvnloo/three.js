import { WebGLShadowMap } from '../../../../../src/renderers/webgl/WebGLShadowMap.js';
import { DirectionalLight } from '../../../../../src/lights/DirectionalLight.js';
import { PerspectiveCamera } from '../../../../../src/cameras/PerspectiveCamera.js';
import { Scene } from '../../../../../src/scenes/Scene.js';
import { Vector4 } from '../../../../../src/math/Vector4.js';

function createFixture() {

	const viewportCalls = [];
	const renderTargetCalls = [];
	const renderer = {
		state: {
			buffers: {
				depth: { getReversed: () => false, setTest: () => {} },
				color: { setClear: () => {} }
			},
			setBlending: () => {},
			setScissorTest: () => {},
			viewport: ( viewport ) => viewportCalls.push( viewport.clone() )
		},
		getRenderTarget: () => null,
		getActiveCubeFace: () => 0,
		getActiveMipmapLevel: () => 0,
		setRenderTarget: ( target ) => renderTargetCalls.push( target ),
		clear: () => {}
	};

	const shadowMap = new WebGLShadowMap( renderer, {}, { maxTextureSize: 1024 } );
	const light = new DirectionalLight();
	light.castShadow = true;

	return { renderer, shadowMap, light, scene: new Scene(), viewportCalls, renderTargetCalls };

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGL', () => {

		QUnit.module( 'WebGLShadowMap', () => {

			QUnit.test( 'setup allocates without automatic shadow updates or drawing', ( assert ) => {

				const { shadowMap, light, scene, viewportCalls, renderTargetCalls } = createFixture();
				shadowMap.enabled = true;
				shadowMap.autoUpdate = false;
				shadowMap.needsUpdate = false;
				light.shadow.autoUpdate = false;
				light.shadow.mapSize.set( 128, 64 );

				assert.strictEqual( light.shadow.map, null, 'no target before setup' );
				shadowMap.setup( [ light ], scene );

				assert.notStrictEqual( light.shadow.map, null, 'setup allocates the target' );
				assert.strictEqual( light.shadow.map.width, 128, 'requested width' );
				assert.strictEqual( light.shadow.map.height, 64, 'requested height' );
				assert.notStrictEqual( light.shadow.map.depthTexture, null, 'depth texture allocated' );
				assert.strictEqual( viewportCalls.length, 0, 'does not draw a viewport' );
				assert.strictEqual( renderTargetCalls.length, 0, 'does not bind a render target' );
				assert.strictEqual( shadowMap.needsUpdate, false, 'does not schedule a shadow draw' );

				light.shadow.dispose();

			} );

			QUnit.test( 'setup resizes an existing 2D shadow target', ( assert ) => {

				const { shadowMap, light, scene } = createFixture();
				shadowMap.enabled = true;
				light.shadow.mapSize.set( 128, 64 );
				shadowMap.setup( [ light ], scene );

				const oldTarget = light.shadow.map;
				light.shadow.mapSize.set( 256, 128 );
				shadowMap.setup( [ light ], scene );

				assert.strictEqual( light.shadow.map, oldTarget, 'keeps existing target' );
				assert.strictEqual( light.shadow.map.width, 256, 'width follows new mapSize' );
				assert.strictEqual( light.shadow.map.height, 128, 'height follows new mapSize' );
				assert.strictEqual( light.shadow.map.viewport.z, 256, 'render-target viewport width follows resize' );
				assert.strictEqual( light.shadow.map.viewport.w, 128, 'render-target viewport height follows resize' );

				light.shadow.dispose();

			} );

			QUnit.test( 'setup does not allocate while shadows are disabled', ( assert ) => {

				const { shadowMap, light, scene } = createFixture();
				shadowMap.enabled = false;
				shadowMap.setup( [ light ], scene );

				assert.strictEqual( light.shadow.map, null, 'disabled setup keeps map null' );

			} );

			QUnit.test( 'render preserves four shadow atlas viewports', ( assert ) => {

				const { shadowMap, light, scene, viewportCalls } = createFixture();
				const shadow = light.shadow;
				shadowMap.enabled = true;
				shadow.mapSize.set( 32, 32 );
				shadow._frameExtents.set( 2, 2 );
				shadow._viewportCount = 4;
				shadow._viewports = [
					new Vector4( 0, 0, 1, 1 ),
					new Vector4( 1, 0, 1, 1 ),
					new Vector4( 0, 1, 1, 1 ),
					new Vector4( 1, 1, 1, 1 )
				];

				scene.add( light, light.target );
				scene.updateMatrixWorld( true );
				const camera = new PerspectiveCamera();
				camera.updateMatrixWorld( true );

				shadowMap.render( [ light ], scene, camera );

				assert.strictEqual( shadow.map.width, 64, 'two atlas columns' );
				assert.strictEqual( shadow.map.height, 64, 'two atlas rows' );
				assert.deepEqual( viewportCalls.map( viewport => viewport.toArray() ), [
					[ 0, 0, 32, 32 ],
					[ 32, 0, 32, 32 ],
					[ 0, 32, 32, 32 ],
					[ 32, 32, 32, 32 ]
				], 'all four shadow viewports rendered' );

				shadow.dispose();

			} );

		} );

	} );

} );
