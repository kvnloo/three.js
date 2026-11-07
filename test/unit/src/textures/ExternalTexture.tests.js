import { ExternalTexture } from '../../../../src/textures/ExternalTexture.js';
import { RenderTarget } from '../../../../src/core/RenderTarget.js';

export default QUnit.module( 'Textures', () => {

	QUnit.module( 'ExternalTexture', () => {

		QUnit.test( 'GPU source dimensions populate image', ( assert ) => {

			const texture = new ExternalTexture( { width: 64, height: 32, depthOrArrayLayers: 2 } );

			assert.deepEqual( texture.image, { width: 64, height: 32, depth: 2 }, '64 x 32 x 2 source dimensions' );

		} );

		QUnit.test( 'source reassignment updates dimensions and invalidates texture', ( assert ) => {

			const texture = new ExternalTexture( { width: 64, height: 32, depthOrArrayLayers: 1 } );
			const initialVersion = texture.version;

			texture.sourceTexture = { width: 128, height: 96, depthOrArrayLayers: 3 };

			assert.deepEqual( texture.image, { width: 128, height: 96, depth: 3 }, '128 x 96 x 3 source dimensions' );
			assert.strictEqual( texture.version, initialVersion + 1, 'rebind requests a renderer update' );

		} );

		QUnit.test( 'render-target assignment tracks replacement attachments and ownership', ( assert ) => {

			const target = new RenderTarget( 64, 32, { count: 2 } );
			const previous = target.texture;
			const first = new ExternalTexture( { width: 64, height: 32, depthOrArrayLayers: 1 } );
			const second = new ExternalTexture( { width: 64, height: 32, depthOrArrayLayers: 1 } );

			target.texture = first;

			assert.strictEqual( first.isRenderTargetTexture, true, 'texture setter flags the attachment' );
			assert.strictEqual( first.renderTarget, target, 'texture setter sets its owner' );
			assert.strictEqual( previous.renderTarget, null, 'replaced attachment loses stale ownership' );

			target.textures = [ first, second ];

			assert.strictEqual( second.isRenderTargetTexture, true, 'MRT setter flags the second attachment' );
			assert.strictEqual( second.renderTarget, target, 'MRT setter sets its owner' );
			assert.strictEqual( target.textures.length, 2, 'two attachments remain' );

		} );

	} );

} );
