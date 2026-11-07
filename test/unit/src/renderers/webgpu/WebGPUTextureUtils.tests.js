import WebGPUTextureUtils from '../../../../../src/renderers/webgpu/utils/WebGPUTextureUtils.js';

function createFixture( queue, width, height ) {

	const image = {};
	const gpuTexture = {};
	const texture = { isHTMLTexture: true, image, mipmaps: [], flipY: false, version: 1 };
	const textureData = {
		texture: gpuTexture,
		textureDescriptorGPU: { size: { width, height } },
		hasPaintCallback: true
	};
	const backend = {
		device: { queue },
		renderer: { domElement: { requestPaint() { throw new Error( 'Unexpected paint request' ); } } },
		get( queried ) {
			if ( queried !== texture ) throw new Error( 'Unexpected texture' );
			return textureData;
		}
	};

	return { utils: new WebGPUTextureUtils( backend ), texture, textureData, image, gpuTexture };

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGPU', () => {

		QUnit.module( 'WebGPUTextureUtils', () => {

			QUnit.test( 'HTMLTexture: Chromium 155+ draw-only signature', ( assert ) => {

				const calls = [];
				const queue = {
					drawElementImageToTexture( source, destination ) {
						calls.push( { source, destination } );
					}
				};
				const f = createFixture( queue, 64, 32 );

				f.utils.updateTexture( f.texture, {} );

				assert.deepEqual( calls, [ {
					source: { source: f.image },
					destination: { texture: f.gpuTexture, size: { width: 64, height: 32 } }
				} ], 'Draw-only signature copies once with the full destination size' );
				assert.strictEqual( f.textureData.version, 1, 'Upload updates the texture version' );
				assert.strictEqual( f.utils._elementImageCopyVariant, 0, 'Newest signature is cached' );

			} );

			QUnit.test( 'HTMLTexture: Chromium 150-154 dictionary signature', ( assert ) => {

				const calls = [];
				const queue = {
					copyElementImageToTexture( source, destination ) {
						if ( arguments.length !== 2 || ! source.source || ! destination.destination ) {
							throw new TypeError( 'Expected dictionary overload' );
						}
						calls.push( { source, destination } );
					}
				};
				const f = createFixture( queue, 7, 5 );

				f.utils.updateTexture( f.texture, {} );

				assert.deepEqual( calls, [ {
					source: { source: f.image },
					destination: { destination: { texture: f.gpuTexture }, width: 7, height: 5 }
				} ], 'Dictionary signature uses width and height in the second argument' );
				assert.strictEqual( f.textureData.version, 1, 'Upload updates the texture version' );
				assert.strictEqual( f.utils._elementImageCopyVariant, 1, 'Dictionary signature is cached' );

			} );

			QUnit.test( 'HTMLTexture: Chromium 138-149 four-argument signature with length two', ( assert ) => {

				const calls = [];
				const queue = {
					copyElementImageToTexture( element, width ) {
						if ( arguments.length !== 4 || typeof width !== 'number' ) {
							throw new TypeError( 'Expected four positional arguments' );
						}
						calls.push( Array.from( arguments ) );
					}
				};
				const f = createFixture( queue, 9, 6 );

				assert.strictEqual( queue.copyElementImageToTexture.length, 2, 'Legacy function reports the ambiguous arity' );
				f.utils.updateTexture( f.texture, {} );

				assert.deepEqual( calls, [ [ f.image, 9, 6, { texture: f.gpuTexture } ] ], 'Fallback copies once with four positional arguments' );
				assert.strictEqual( f.textureData.version, 1, 'Upload updates the texture version' );
				assert.strictEqual( f.utils._elementImageCopyVariant, 2, 'Legacy signature is cached' );

			} );

		} );

	} );

} );
