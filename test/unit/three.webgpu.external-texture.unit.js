import { ExternalTexture } from '../../src/textures/ExternalTexture.js';
import { RenderTarget } from '../../src/core/RenderTarget.js';
import WebGPUBackend from '../../src/renderers/webgpu/WebGPUBackend.js';

function clearMSAA( device, msaaTexture, resolveTexture, clearValue ) {

	const encoder = device.createCommandEncoder();
	const pass = encoder.beginRenderPass( {
		colorAttachments: [ {
			view: msaaTexture.createView(),
			resolveTarget: resolveTexture.createView(),
			clearValue,
			loadOp: 'clear',
			storeOp: 'store'
		} ]
	} );

	pass.end();
	device.queue.submit( [ encoder.finish() ] );

}

async function readPixel( device, texture ) {

	const buffer = device.createBuffer( {
		size: 256,
		usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
	} );

	const encoder = device.createCommandEncoder();
	encoder.copyTextureToBuffer(
		{ texture },
		{ buffer, bytesPerRow: 256 },
		{ width: 1, height: 1, depthOrArrayLayers: 1 }
	);
	device.queue.submit( [ encoder.finish() ] );

	await buffer.mapAsync( GPUMapMode.READ );

	const pixel = Array.from( new Uint8Array( buffer.getMappedRange(), 0, 4 ) );
	buffer.unmap();
	buffer.destroy();

	return pixel;

}

export default QUnit.module( 'WebGPU', () => {

	QUnit.test( 'ExternalTexture: 4x MSAA resolve, source rebind and resize retain caller ownership', async ( assert ) => {

		assert.ok( navigator.gpu, 'requires a WebGPU browser; unavailable is a test failure' );
		if ( ! navigator.gpu ) return;

		const adapter = await navigator.gpu.requestAdapter();

		assert.ok( adapter, 'requires a working WebGPU adapter' );
		if ( ! adapter ) return;

		const device = await adapter.requestDevice();
		const format = 'rgba8unorm';
		const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;

		const firstSource = device.createTexture( { size: [ 64, 32, 1 ], format, usage } );
		const secondSource = device.createTexture( { size: [ 128, 96, 1 ], format, usage } );
		const target = new RenderTarget( 64, 32, { samples: 4, depthBuffer: false } );
		const texture = new ExternalTexture( firstSource );

		target.texture = texture;

		const backend = new WebGPUBackend( { device } );
		backend.device = device;

		try {

			device.pushErrorScope( 'validation' );
			backend.textureUtils.createTexture( texture );

			const initialData = backend.get( texture );
			const oldMSAA = initialData.msaaTexture;

			assert.strictEqual( initialData.texture, firstSource, 'initial resolve attachment is caller-owned' );
			assert.strictEqual( initialData.format, format, 'the external format is used' );
			assert.ok( oldMSAA, 'a multisampled GPU attachment was allocated' );
			assert.strictEqual( oldMSAA.sampleCount, 4, 'four actual GPU samples' );
			assert.strictEqual( oldMSAA.width, 64, 'initial MSAA width' );
			assert.strictEqual( oldMSAA.height, 32, 'initial MSAA height' );

			clearMSAA( device, oldMSAA, firstSource, { r: 1, g: 0, b: 0, a: 1 } );
			assert.deepEqual( await readPixel( device, firstSource ), [ 255, 0, 0, 255 ], 'first resolve is red' );
			assert.strictEqual( await device.popErrorScope(), null, 'initial MSAA pass validates on the GPU' );

			const versionBefore = texture.version;
			texture.sourceTexture = secondSource;
			target.setSize( 128, 96 );

			assert.strictEqual( texture.version, versionBefore + 1, 'source rebinding invalidates the renderer texture' );

			device.pushErrorScope( 'validation' );
			backend.textureUtils.createTexture( texture );

			const reboundData = backend.get( texture );
			const newMSAA = reboundData.msaaTexture;

			assert.strictEqual( reboundData.texture, secondSource, 'resolve attachment was rebound' );
			assert.notStrictEqual( newMSAA, oldMSAA, 'old three-owned MSAA attachment was replaced' );
			assert.strictEqual( newMSAA.sampleCount, 4, '4x MSAA retained after rebind' );
			assert.strictEqual( newMSAA.width, 128, 'resized MSAA width' );
			assert.strictEqual( newMSAA.height, 96, 'resized MSAA height' );
			assert.deepEqual( texture.image, { width: 128, height: 96, depth: 1 }, 'image matches new external source' );

			clearMSAA( device, newMSAA, secondSource, { r: 0, g: 1, b: 0, a: 1 } );
			assert.deepEqual( await readPixel( device, secondSource ), [ 0, 255, 0, 255 ], 'rebound resolve is green' );
			assert.strictEqual( await device.popErrorScope(), null, 'rebound MSAA pass validates on the GPU' );

			device.pushErrorScope( 'validation' );
			oldMSAA.createView();
			assert.ok( await device.popErrorScope(), 'old three-owned MSAA allocation is destroyed' );

			backend.textureUtils.destroyTexture( texture );

			device.pushErrorScope( 'validation' );
			assert.deepEqual( await readPixel( device, firstSource ), [ 255, 0, 0, 255 ], 'old caller texture remains usable' );
			assert.deepEqual( await readPixel( device, secondSource ), [ 0, 255, 0, 255 ], 'new caller texture survives disposal' );
			assert.strictEqual( await device.popErrorScope(), null, 'caller-owned source textures are not destroyed' );

		} finally {

			firstSource.destroy();
			secondSource.destroy();
			device.destroy();

		}

	} );

} );
