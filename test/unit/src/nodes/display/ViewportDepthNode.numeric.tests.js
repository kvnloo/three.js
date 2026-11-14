import {
	LinearSRGBColorSpace, Mesh, NoToneMapping, OrthographicCamera,
	PerspectiveCamera, PlaneGeometry, RenderTarget, Scene
} from 'three';
import { MeshBasicNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { float, vec3 } from 'three/tsl';
import { linearDepth } from '../../../../../src/nodes/display/ViewportDepthNode.js';

async function sampleLinearDepth( camera, rawDepth, depthOptions ) {

	const renderer = new WebGPURenderer( {
		canvas: document.createElement( 'canvas' ),
		antialias: false,
		...depthOptions
	} );
	const target = new RenderTarget( 1, 1, {
		colorSpace: LinearSRGBColorSpace,
		depthBuffer: false
	} );
	const geometry = new PlaneGeometry( 10, 10 );
	const material = new MeshBasicNodeMaterial( {
		toneMapped: false,
		depthTest: false,
		depthWrite: false
	} );
	material.colorNode = vec3( linearDepth( float( rawDepth ) ), 0, 0 );

	const quad = new Mesh( geometry, material );
	quad.position.z = - 5;
	const scene = new Scene();
	scene.add( quad );

	try {

		await renderer.init();

		if ( renderer.backend.isWebGPUBackend !== true ) {

			throw new Error( 'Native WebGPU backend required for depth regression' );

		}

		renderer.outputColorSpace = LinearSRGBColorSpace;
		renderer.toneMapping = NoToneMapping;
		renderer.setSize( 1, 1 );
		renderer.setRenderTarget( target );
		renderer.render( scene, camera );

		const pixels = await renderer.readRenderTargetPixelsAsync( target, 0, 0, 1, 1 );
		return pixels[ 0 ] / 255;

	} finally {

		renderer.setRenderTarget( null );
		geometry.dispose();
		material.dispose();
		target.dispose();
		if ( renderer.initialized ) await renderer.dispose();

	}

}

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'Display', () => {

		QUnit.module( 'ViewportDepthNode numeric', () => {

			QUnit.test( 'ordinary perspective linear depth is unchanged', async ( assert ) => {

				const camera = new PerspectiveCamera( 60, 1, 1, 100 );
				const actual = await sampleLinearDepth( camera, 0.5, {} );
				const expected = ( 100 / 50.5 - 1 ) / 99;

				assert.ok( Math.abs( actual - expected ) < 2 / 255,
					'perspective 0.5 yields 0.009901, actual=' + actual );

			} );

			QUnit.test( 'logarithmic perspective uses logarithmic decode', async ( assert ) => {

				const camera = new PerspectiveCamera( 60, 1, 1, 100 );
				const actual = await sampleLinearDepth( camera, 0.5, { logarithmicDepthBuffer: true } );
				const expected = 9 / 99;

				assert.ok( Math.abs( actual - expected ) < 2 / 255,
					'logarithmic depth 0.5 yields 0.090909, actual=' + actual );

			} );

			QUnit.test( 'reversed orthographic depth is uninverted', async ( assert ) => {

				const camera = new OrthographicCamera( - 1, 1, 1, - 1, 1, 100 );
				const actual = await sampleLinearDepth( camera, 0.25, { reversedDepthBuffer: true } );

				assert.ok( Math.abs( actual - 0.75 ) < 2 / 255,
					'reversed orthographic depth 0.25 yields 0.75, actual=' + actual );

			} );

		} );

	} );

} );
