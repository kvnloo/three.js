import { KTX2Loader } from '../../../../examples/jsm/loaders/KTX2Loader.js';

function webGLRendererWithExtensions( names ) {

	const supported = new Set( names );

	return {
		extensions: {
			has( name ) { return supported.has( name ); },
			get() { return null; }
		}
	};

}

function webGPURendererWithFeatures( names, queries = [] ) {

	const supported = new Set( names );

	return {
		isWebGPURenderer: true,
		hasFeature( name ) {

			queries.push( name );
			return supported.has( name );

		}
	};

}

export default QUnit.module( 'Addons', () => {

	QUnit.module( 'Loaders', () => {

		QUnit.module( 'KTX2Loader', () => {

			QUnit.test( 'WebGL: RGTC-only hardware reports RGTC, not S3TC or BPTC', ( assert ) => {

				const loader = new KTX2Loader().detectSupport( webGLRendererWithExtensions( [ 'EXT_texture_compression_rgtc' ] ) );

				assert.strictEqual( loader.workerConfig.rgtcSupported, true );
				assert.strictEqual( loader.workerConfig.dxtSupported, false );
				assert.strictEqual( loader.workerConfig.bptcSupported, false );
				assert.strictEqual( loader.workerConfig.etc2Supported, false );

			} );

			QUnit.test( 'WebGL: unsupported compression extensions report false flags', ( assert ) => {

				const loader = new KTX2Loader().detectSupport( webGLRendererWithExtensions( [] ) );

				assert.strictEqual( loader.workerConfig.rgtcSupported, false );
				assert.strictEqual( loader.workerConfig.bptcSupported, false );
				assert.strictEqual( loader.workerConfig.dxtSupported, false );

			} );

			QUnit.test( 'WebGL: BPTC does not imply RGTC or S3TC', ( assert ) => {

				const loader = new KTX2Loader().detectSupport( webGLRendererWithExtensions( [ 'EXT_texture_compression_bptc' ] ) );

				assert.strictEqual( loader.workerConfig.bptcSupported, true );
				assert.strictEqual( loader.workerConfig.rgtcSupported, false );
				assert.strictEqual( loader.workerConfig.dxtSupported, false );

			} );

			QUnit.test( 'WebGPU: BC capability does not claim legacy ETC1, S3TC, or RGTC flags', ( assert ) => {

				const queries = [];
				const loader = new KTX2Loader().detectSupport( webGPURendererWithFeatures( [ 'texture-compression-bc' ], queries ) );

				assert.strictEqual( loader.workerConfig.bptcSupported, true );
				assert.strictEqual( loader.workerConfig.rgtcSupported, false );
				assert.strictEqual( loader.workerConfig.dxtSupported, false );
				assert.strictEqual( loader.workerConfig.etc1Supported, false );
				assert.strictEqual( loader.workerConfig.etc2Supported, false );
				assert.notOk( queries.includes( 'texture-compression-etc1' ) );
				assert.notOk( queries.includes( 'texture-compression-s3tc' ) );

			} );

			QUnit.test( 'WebGPU: ETC2 support is independent of BC and ETC1 flags', ( assert ) => {

				const loader = new KTX2Loader().detectSupport( webGPURendererWithFeatures( [ 'texture-compression-etc2' ] ) );

				assert.strictEqual( loader.workerConfig.etc2Supported, true );
				assert.strictEqual( loader.workerConfig.etc1Supported, false );
				assert.strictEqual( loader.workerConfig.bptcSupported, false );
				assert.strictEqual( loader.workerConfig.rgtcSupported, false );

			} );

		} );

	} );

} );
