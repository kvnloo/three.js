import { OrthographicCamera } from '../../../../../src/cameras/OrthographicCamera.js';
import { PlaneGeometry } from '../../../../../src/geometries/PlaneGeometry.js';
import { ShaderMaterial } from '../../../../../src/materials/ShaderMaterial.js';
import { Mesh } from '../../../../../src/objects/Mesh.js';
import { Scene } from '../../../../../src/scenes/Scene.js';
import { TextureSource } from '../../../../../src/textures/TextureSource.js';
import { WebGLRenderTarget } from '../../../../../src/renderers/WebGLRenderTarget.js';
import { WebGLRenderer } from '../../../../../src/renderers/WebGLRenderer.js';

function createHarness() {

	const renderer = new WebGLRenderer( { canvas: document.createElement( 'canvas' ) } );
	renderer.setSize( 1, 1, false );
	renderer.setClearColor( 0x000000, 0 );

	const camera = new OrthographicCamera( - 1, 1, 1, - 1, 0.1, 10 );
	camera.position.z = 1;

	const material = new ShaderMaterial( {
		vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
		fragmentShader: `
#define OUTPUT_QUALIFIER out
#if !defined( out_Second ) && !defined( out_Aux )
layout( location = 1 ) OUTPUT_QUALIFIER vec4 fallbackOutput;
#endif
void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
#ifdef out_Second
	out_Second = vec4( 0.0, 1.0, 0.0, 1.0 );
#elif defined( out_Aux )
	out_Aux = vec4( 0.0, 0.0, 1.0, 1.0 );
#else
	fallbackOutput = vec4( 1.0, 0.0, 0.0, 1.0 );
#endif
}
`
	} );

	const geometry = new PlaneGeometry( 2, 2 );
	const scene = new Scene();
	scene.add( new Mesh( geometry, material ) );

	return { renderer, camera, material, geometry, scene };

}

function renderPixel( harness, target, attachment ) {

	harness.renderer.setRenderTarget( target );
	harness.renderer.render( harness.scene, harness.camera );

	const pixel = new Uint8Array( 4 );
	harness.renderer.readRenderTargetPixels( target, 0, 0, 1, 1, pixel, undefined, attachment );
	return Array.from( pixel );

}

function disposeHarness( harness, ...targets ) {

	harness.renderer.setRenderTarget( null );
	for ( const target of targets ) target.dispose();
	harness.geometry.dispose();
	harness.material.dispose();
	harness.renderer.dispose();

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGL', () => {

		QUnit.module( 'WebGLMRTOutputs', () => {

			QUnit.test( 'single target retains location-zero red', ( assert ) => {

				const harness = createHarness();
				const target = new WebGLRenderTarget( 1, 1 );
				target.texture.name = 'Color';

				try {

					assert.deepEqual( renderPixel( harness, target, 0 ), [ 255, 0, 0, 255 ] );

				} finally {

					disposeHarness( harness, target );

				}

			} );

			QUnit.test( 'second named MRT output writes green', ( assert ) => {

				const harness = createHarness();
				const target = new WebGLRenderTarget( 1, 1, { count: 2 } );
				target.textures[ 0 ].name = 'Color';
				target.textures[ 1 ].name = 'Second';

				try {

					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 255, 0, 255 ] );

				} finally {

					disposeHarness( harness, target );

				}

			} );

			QUnit.test( 'renaming an attachment updates outputs on the same target', ( assert ) => {

				const harness = createHarness();
				const target = new WebGLRenderTarget( 1, 1, { count: 2 } );
				target.textures[ 0 ].name = 'Color';
				target.textures[ 1 ].name = 'Second';

				try {

					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 255, 0, 255 ], 'original name' );
					target.textures[ 1 ].name = 'Aux';
					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 0, 255, 255 ], 'new name, same target and texture' );
					target.textures[ 1 ].name = 'Second';
					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 255, 0, 255 ], 'cached program restored' );

				} finally {

					disposeHarness( harness, target );

				}

			} );

			QUnit.test( 'replacing an attachment rebinds its GPU texture', ( assert ) => {

				const harness = createHarness();
				const target = new WebGLRenderTarget( 1, 1, { count: 2 } );
				target.textures[ 0 ].name = 'Color';
				target.textures[ 1 ].name = 'Second';

				try {

					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 255, 0, 255 ], 'original attachment' );

					const gl = harness.renderer.getContext();
					const previousAttachment = gl.getFramebufferAttachmentParameter( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME );
					const allocatedTextures = harness.renderer.info.memory.textures;

					const replacement = target.textures[ 1 ].clone();
					replacement.source = new TextureSource( { width: 1, height: 1, depth: 1 } );
					target.textures[ 1 ] = replacement;

					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 255, 0, 255 ], 'replacement with same name' );

					const currentAttachment = gl.getFramebufferAttachmentParameter( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME );

					assert.ok( previousAttachment, 'original GPU attachment exists' );
					assert.ok( currentAttachment, 'replacement GPU attachment exists' );
					assert.notStrictEqual( currentAttachment, previousAttachment, 'framebuffer points at a new GPU texture' );
					assert.strictEqual( harness.renderer.info.memory.textures, allocatedTextures, 'replaced GPU texture was freed' );

					replacement.name = 'Aux';
					assert.deepEqual( renderPixel( harness, target, 1 ), [ 0, 0, 255, 255 ], 'new texture can also be renamed' );

				} finally {

					disposeHarness( harness, target );

				}

			} );

			QUnit.test( 'switching targets rebuilds named MRT outputs', ( assert ) => {

				const harness = createHarness();
				const first = new WebGLRenderTarget( 1, 1, { count: 2 } );
				const second = new WebGLRenderTarget( 1, 1, { count: 2 } );
				first.textures[ 0 ].name = 'Color';
				first.textures[ 1 ].name = 'Second';
				second.textures[ 0 ].name = 'Color';
				second.textures[ 1 ].name = 'Aux';

				try {

					assert.deepEqual( renderPixel( harness, first, 1 ), [ 0, 255, 0, 255 ] );
					assert.deepEqual( renderPixel( harness, second, 1 ), [ 0, 0, 255, 255 ] );

				} finally {

					disposeHarness( harness, first, second );

				}

			} );

		} );

	} );

} );
