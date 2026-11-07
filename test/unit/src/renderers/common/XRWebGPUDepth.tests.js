import DirectRenderPipeline from '../../../../../src/renderers/common/DirectRenderPipeline.js';
import XRManager from '../../../../../src/renderers/common/XRManager.js';

function probeDirectXR( autoAllocateDepthBuffer, isPresenting ) {

	const target = {
		samples: 2,
		depthBuffer: false,
		_autoAllocateDepthBuffer: autoAllocateDepthBuffer
	};
	let during;

	const renderer = {
		samples: 4,
		toneMapping: 0,
		outputColorSpace: 'srgb',
		contextNode: null,
		isOutputTarget: true,
		backend: { isWebGPUBackend: true },
		xr: { isPresenting, enabled: false },
		getOutputRenderTarget: () => target,
		render: () => {
			during = { samples: target.samples, depthBuffer: target.depthBuffer };
		}
	};

	const pipeline = new DirectRenderPipeline( renderer );
	pipeline._update = () => {};
	pipeline._contextData = {
		onBeforePipelineCallbacks: [],
		onAfterPipelineCallbacks: []
	};

	pipeline.render( {}, {} );
	pipeline.dispose();

	return {
		during,
		after: { samples: target.samples, depthBuffer: target.depthBuffer }
	};

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'Common', () => {

		QUnit.module( 'XR WebGPU depth', () => {

			QUnit.test( 'direct XR samples match supplied versus local depth', ( assert ) => {

				const external = probeDirectXR( false, true );
				assert.deepEqual( external.during, { samples: 0, depthBuffer: true },
					'single-sample external depth disables 4x MSAA' );
				assert.deepEqual( external.after, { samples: 2, depthBuffer: false },
					'original target state is restored' );

				const local = probeDirectXR( true, true );
				assert.deepEqual( local.during, { samples: 4, depthBuffer: true },
					'local depth retains 4x MSAA' );
				assert.deepEqual( local.after, { samples: 2, depthBuffer: false },
					'local target state is restored' );

				const notXR = probeDirectXR( false, false );
				assert.deepEqual( notXR.during, { samples: 2, depthBuffer: false },
					'non-XR rendering leaves sample count untouched' );

			} );

			QUnit.test( 'two views share runtime depth only when enabled', ( assert ) => {

				const xr = new XRManager( { backend: { isWebGPUBackend: true } } );
				const layer = { textureWidth: 1200, textureHeight: 700 };
				const views = [ { eye: 'left' }, { eye: 'right' } ];
				const colorTexture = { format: 'rgba8unorm' };
				const depthTexture = { format: 'depth24plus' };
				const viewports = [
					{ x: 0, y: 0, width: 600, height: 700 },
					{ x: 600, y: 0, width: 600, height: 700 }
				];
				const descriptors = [
					{ baseArrayLayer: 0, arrayLayerCount: 1 },
					{ baseArrayLayer: 1, arrayLayerCount: 1 }
				];

				xr._glProjLayer = layer;
				xr.getWebGPUBinding = () => ( {
					getViewSubImage( projectionLayer, view ) {

						const i = views.indexOf( view );
						if ( projectionLayer !== layer || i === - 1 ) throw new Error( 'Unexpected view' );

						return {
							colorTexture,
							depthStencilTexture: depthTexture,
							viewport: viewports[ i ],
							getViewDescriptor: () => descriptors[ i ]
						};

					}
				} );

				xr._webgpuSupplyDepth = true;
				const enabled = xr._getWebGPUViewData( views );
				assert.strictEqual( enabled.depthTexture, depthTexture,
					'one browser-owned depth texture shared across two eyes' );
				assert.strictEqual( enabled.colorTexture, colorTexture, 'color remains shared' );
				assert.deepEqual( enabled.viewDescriptors, descriptors, 'both per-eye descriptors preserved' );
				assert.deepEqual( enabled.viewports, viewports, 'both numerical viewports preserved' );

				xr._webgpuSupplyDepth = false;
				const disabled = xr._getWebGPUViewData( views );
				assert.strictEqual( disabled.depthTexture, null,
					'depth is not forwarded when runtime disables supply' );
				assert.strictEqual( disabled.colorTexture, colorTexture, 'color is still forwarded' );

			} );

		} );

	} );

} );
