import { TimestampQuery } from '../../../../../src/constants.js';
import WebGPUBackend from '../../../../../src/renderers/webgpu/WebGPUBackend.js';
import GPURenderPassTimestampWrites from '../../../../../src/renderers/webgpu/descriptors/GPURenderPassTimestampWrites.js';

function createBackend() {

	const backend = new WebGPUBackend( { trackTimestamp: true } );
	const querySet = {};
	let nextOffset = 0;

	backend.timestampQueryPool[ TimestampQuery.RENDER ] = {
		querySet,
		allocateQueriesForContext() {

			const offset = nextOffset;
			nextOffset += 2;
			return offset;

		}
	};

	return backend;

}

function slots( writes ) {

	return {
		begin: writes?.beginningOfPassWriteIndex,
		end: writes?.endOfPassWriteIndex
	};

}

function writePassTimes( writes, start, finish, times ) {

	if ( writes?.beginningOfPassWriteIndex !== undefined ) times[ writes.beginningOfPassWriteIndex ] = start;
	if ( writes?.endOfPassWriteIndex !== undefined ) times[ writes.endOfPassWriteIndex ] = finish;

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGPUBackend timestamp queries', () => {

		QUnit.test( 'nested contexts keep independent query slots', ( assert ) => {

			const backend = createBackend();
			const outer = {};
			const inner = {};
			const times = [];

			backend.initTimestampQuery( TimestampQuery.RENDER, 'outer:f1', outer, new GPURenderPassTimestampWrites() );
			writePassTimes( outer.timestampWrites, 10, 25, times );

			backend.initTimestampQuery( TimestampQuery.RENDER, 'inner:f1', inner, new GPURenderPassTimestampWrites() );
			writePassTimes( inner.timestampWrites, 27, 32, times );

			assert.notStrictEqual( outer.timestampWrites, inner.timestampWrites, 'nested descriptors do not alias' );
			assert.deepEqual( slots( outer.timestampWrites ), { begin: 0, end: 1 }, 'outer slots unchanged' );
			assert.deepEqual( slots( inner.timestampWrites ), { begin: 2, end: 3 }, 'inner slots distinct' );

			const resumed = backend._getResumedTimestampWrites( { timestampWrites: outer.timestampWrites } );
			writePassTimes( resumed, 35, 50, times );

			assert.deepEqual( slots( resumed ), { begin: undefined, end: 1 }, 'outer resume updates end only' );
			assert.strictEqual( times[ 1 ] - times[ 0 ], 40, 'outer spans 10 through 50' );
			assert.strictEqual( times[ 3 ] - times[ 2 ], 5, 'inner still spans 27 through 32' );

		} );

		QUnit.test( 'framebuffer copy resume preserves the original start', ( assert ) => {

			const backend = createBackend();
			const source = {};
			const destination = { id: 7 };
			const context = {
				renderTarget: {},
				textures: [ source ],
				depth: false,
				stencil: false,
				viewport: false,
				scissor: false
			};

			backend.get( source ).texture = { format: 'rgba8unorm' };
			backend.get( destination ).texture = { format: 'rgba8unorm' };

			const descriptor = {
				colorAttachments: [ { loadOp: 'clear' } ],
				timestampWrites: new GPURenderPassTimestampWrites()
			};

			backend.initTimestampQuery( TimestampQuery.RENDER, 'copy:f1', descriptor, descriptor.timestampWrites );

			const times = [];
			const observed = [];
			let copies = 0;
			writePassTimes( descriptor.timestampWrites, 10, 40, times );

			const encoder = {
				beginRenderPass( passDescriptor ) {

					observed.push( slots( passDescriptor.timestampWrites ) );
					writePassTimes( passDescriptor.timestampWrites, 50, 60, times );
					return { end() {} };

				}
			};

			Object.assign( backend.get( context ), {
				descriptor,
				timestampWrites: descriptor.timestampWrites,
				currentPass: { end() {} },
				encoder
			} );

			backend._isRenderCameraDepthArray = () => false;
			backend._copyFramebufferToTexture = () => { copies ++; };
			backend.copyFramebufferToTexture( destination, context, { x: 0, y: 0, z: 1, w: 1 } );

			assert.strictEqual( copies, 1, 'copy is encoded once' );
			assert.deepEqual( observed, [ { begin: undefined, end: 1 } ], 'resumed pass writes only end' );
			assert.strictEqual( times[ 1 ] - times[ 0 ], 50, 'query spans 10 through 60' );

		} );

		QUnit.test( 'three layered passes keep the first beginning timestamp', ( assert ) => {

			const backend = createBackend();
			const initial = { timestampWrites: new GPURenderPassTimestampWrites() };
			backend.initTimestampQuery( TimestampQuery.RENDER, 'layers:f1', initial, initial.timestampWrites );

			const spans = [ [ 10, 20 ], [ 21, 31 ], [ 32, 47 ] ];
			const observed = [];
			const times = [];
			const layerDescriptors = spans.map( () => ( {
				timestampWrites: initial.timestampWrites,
				colorAttachments: [ { loadOp: 'clear', storeOp: 'store' } ]
			} ) );

			const encoder = {
				beginRenderPass( descriptor ) {

					const [ start, finish ] = spans[ observed.length ];
					observed.push( slots( descriptor.timestampWrites ) );
					writePassTimes( descriptor.timestampWrites, start, finish, times );
					return { executeBundles() {}, end() {} };

				},
				finish() { return {}; }
			};

			const context = {
				camera: {},
				occlusionQueryCount: 0,
				depth: false,
				stencil: false,
				viewport: false,
				scissor: false,
				textures: null
			};

			Object.assign( backend.get( context ), {
				timestampWrites: initial.timestampWrites,
				renderBundles: [],
				arrayCameraRenderStages: [],
				layerDescriptors,
				encoder,
				currentPass: null
			} );

			backend.device = { queue: { submit() {} } };
			backend._isRenderCameraDepthArray = () => true;
			backend._finishArrayCameraBundleEncoders = () => spans.map( () => ( {} ) );
			backend.finishRender( context );

			assert.deepEqual( observed, [
				{ begin: 0, end: 1 },
				{ begin: undefined, end: 1 },
				{ begin: undefined, end: 1 }
			], 'only the first layer writes a beginning timestamp' );
			assert.strictEqual( times[ 1 ] - times[ 0 ], 37, 'query spans 10 through 47' );
			assert.ok( layerDescriptors.every( descriptor => descriptor.timestampWrites === initial.timestampWrites ), 'layer descriptors restored' );

		} );

	} );

} );
