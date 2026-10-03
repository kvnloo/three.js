import { PerspectiveCamera } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import {
	createReconstructionReceipt,
	summarizeFrameTimes
} from '../../../../examples/jsm/utils/ReconstructionEvaluation.js';

export default QUnit.module( 'Addons', () => {

	QUnit.module( 'Utils', () => {

		QUnit.module( 'ReconstructionEvaluation', () => {

			QUnit.test( 'summarizeFrameTimes', ( assert ) => {

				assert.deepEqual(
					summarizeFrameTimes( [ 5, 1, 4, 2, 3 ] ),
					{ count: 5, p50Ms: 3, p95Ms: 5, maxMs: 5 },
					'uses deterministic nearest-rank percentiles'
				);

				assert.deepEqual(
					summarizeFrameTimes( [] ),
					{ count: 0, p50Ms: null, p95Ms: null, maxMs: null },
					'handles an empty measurement window'
				);

				assert.throws(
					() => summarizeFrameTimes( [ 1, NaN ] ),
					/frameTimesMs\[1\]/,
					'rejects non-finite timing samples'
				);

			} );

			QUnit.test( 'createReconstructionReceipt', ( assert ) => {

				const camera = new PerspectiveCamera( 50, 4 / 3, 0.1, 100 );
				camera.position.set( 1, 2, 3 );
				camera.updateProjectionMatrix();

				const renderer = {
					isWebGPURenderer: true,
					getSize( target ) {

						return target.set( 800, 600 );

					},
					getPixelRatio() {

						return 2;

					}
				};

				const receipt = createReconstructionReceipt( {
					renderer,
					camera,
					threeRevision: 'abc123',
					sceneRevision: 'scene456',
					frameTimesMs: [ 10, 20, 30, 40 ],
					uploadCount: 7,
					uploadTimeMs: 4.5,
					residentBytes: 16 * 1024 * 1024,
					virtualTexture: true,
					screenshotSha256: 'a'.repeat( 64 )
				} );

				assert.equal( receipt.renderer.backend, 'webgpu', 'records renderer backend' );
				assert.deepEqual( receipt.renderer.viewport, { width: 800, height: 600, dpr: 2 }, 'records viewport separately from DPR' );
				assert.deepEqual( receipt.camera.position, [ 1, 2, 3 ], 'records fixed camera position' );
				assert.equal( receipt.frameTiming.p50Ms, 20, 'records frame p50' );
				assert.equal( receipt.frameTiming.p95Ms, 40, 'records frame p95' );
				assert.deepEqual( receipt.uploads, { count: 7, totalMs: 4.5 }, 'keeps upload timing separate' );
				assert.equal( receipt.residency.bytes, 16 * 1024 * 1024, 'records resident bytes' );
				assert.true( receipt.virtualTexture, 'records VT state' );

				camera.position.set( 9, 9, 9 );
				assert.deepEqual( receipt.camera.position, [ 1, 2, 3 ], 'receipt snapshots camera state' );

			} );

			QUnit.test( 'createReconstructionReceipt records the active WebGL fallback backend', ( assert ) => {

				const renderer = new WebGPURenderer( { forceWebGL: true } );
				const receipt = createReconstructionReceipt( {
					renderer,
					camera: new PerspectiveCamera(),
					threeRevision: 'three',
					sceneRevision: 'scene'
				} );

				assert.true( renderer.isWebGPURenderer, 'fallback retains the WebGPURenderer type flag' );
				assert.true( renderer.backend.isWebGLBackend, 'constructor selects the supported WebGL backend' );
				assert.equal( receipt.renderer.backend, 'webgl', 'receipt reports the active backend, not the renderer class' );

			} );

			QUnit.test( 'createReconstructionReceipt validates receipt identities', ( assert ) => {

				const camera = new PerspectiveCamera();
				const renderer = {
					isWebGLRenderer: true,
					getSize( target ) {

						return target.set( 1, 1 );

					},
					getPixelRatio() {

						return 1;

					}
				};

				assert.throws(
					() => createReconstructionReceipt( { renderer, camera, threeRevision: '', sceneRevision: 'scene' } ),
					/threeRevision/,
					'requires a Three.js revision'
				);

				assert.throws(
					() => createReconstructionReceipt( {
						renderer,
						camera,
						threeRevision: 'three',
						sceneRevision: 'scene',
						screenshotSha256: 'not-a-hash'
					} ),
					/screenshotSha256/,
					'rejects ambiguous screenshot identities'
				);

			} );

		} );

	} );

} );
