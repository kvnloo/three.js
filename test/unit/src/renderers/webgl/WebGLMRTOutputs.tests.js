import { NoToneMapping, LinearSRGBColorSpace, RGBAFormat, UnsignedByteType } from '../../../../../src/constants.js';
import { WebGLRenderTarget } from '../../../../../src/renderers/WebGLRenderTarget.js';
import { WebGLProgram } from '../../../../../src/renderers/webgl/WebGLProgram.js';
import { WebGLPrograms } from '../../../../../src/renderers/webgl/WebGLPrograms.js';
import { WebGLProperties } from '../../../../../src/renderers/webgl/WebGLProperties.js';
import { WebGLTextures } from '../../../../../src/renderers/webgl/WebGLTextures.js';
import { TextureSource } from '../../../../../src/textures/TextureSource.js';

// The Node QUnit runner has no DOM or GPU. Capture GLSL passed to WebGL2
// and real framebufferTexture2D calls instead of fabricating pixel readback.
const fragmentShader = [
	'#define OUTPUT_QUALIFIER out',
	'#if !defined( out_Second ) && !defined( out_Aux )',
	'layout( location = 1 ) OUTPUT_QUALIFIER vec4 fallbackOutput;',
	'#endif',
	'void main() {',
	'	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );',
	'#ifdef out_Second',
	'	out_Second = vec4( 0.0, 1.0, 0.0, 1.0 );',
	'#elif defined( out_Aux )',
	'	out_Aux = vec4( 0.0, 0.0, 1.0, 1.0 );',
	'#else',
	'	fallbackOutput = vec4( 1.0, 0.0, 0.0, 1.0 );',
	'#endif',
	'}'
].join( '\n' );

function createContext() {

	let serial = 0;
	let boundFramebuffer = null;

	const calls = {
		fragmentShaders: [],
		deletedTextures: [],
		deletedFramebuffers: [],
		storage: []
	};

	const gl = {
		VERTEX_SHADER: 0x8B31,
		FRAGMENT_SHADER: 0x8B30,
		FRAMEBUFFER: 0x8D40,
		COLOR_ATTACHMENT0: 0x8CE0,
		TEXTURE_2D: 0x0DE1,
		RGBA: 0x1908,
		RGBA8: 0x8058,
		UNSIGNED_BYTE: 0x1401,

		createProgram: () => ( {} ),
		deleteProgram: () => {},
		createShader: ( type ) => ( { type } ),
		shaderSource: ( shader, source ) => {

			if ( shader.type === gl.FRAGMENT_SHADER ) calls.fragmentShaders.push( source );

		},
		compileShader: () => {},
		attachShader: () => {},
		linkProgram: () => {},
		bindAttribLocation: () => {},

		createTexture: () => ( { id: ++ serial } ),
		deleteTexture: ( texture ) => calls.deletedTextures.push( texture ),
		createFramebuffer: () => ( { id: ++ serial, attachments: new Map() } ),
		deleteFramebuffer: ( framebuffer ) => calls.deletedFramebuffers.push( framebuffer ),
		texParameteri: () => {},
		framebufferTexture2D: ( target, attachment, textureTarget, texture ) => {

			if ( target !== gl.FRAMEBUFFER || textureTarget !== gl.TEXTURE_2D || boundFramebuffer === null ) {

				throw new Error( 'Unexpected framebuffer attachment call' );

			}

			boundFramebuffer.attachments.set( attachment, texture );

		}
	};

	const canvas = {
		width: 1,
		height: 1,
		getContext: ( name ) => name === 'webgl2' ? gl : null
	};
	gl.canvas = canvas;

	const state = {
		bindFramebuffer: ( target, framebuffer ) => {

			if ( target !== gl.FRAMEBUFFER ) throw new Error( 'Unexpected framebuffer target' );
			boundFramebuffer = framebuffer;

		},
		bindTexture: () => {},
		unbindTexture: () => {},
		texImage2D: ( target, level, format, width, height ) => {

			calls.storage.push( { target, level, format, width, height } );

		}
	};

	return { gl, canvas, state, calls };

}

function compileFragment( context, target ) {

	const renderer = {
		getContext: () => context.canvas.getContext( 'webgl2' ),
		getRenderTarget: () => target
	};
	const parameters = {
		defines: {},
		shaderType: 'ShaderMaterial',
		shaderName: 'WebGLMRTOutputs',
		vertexShader: 'void main() { gl_Position = vec4( position, 1.0 ); }',
		fragmentShader,
		precision: 'highp',
		outputColorSpace: LinearSRGBColorSpace,
		toneMapping: NoToneMapping,
		isRawShaderMaterial: false,
		numSpotLightShadows: 0,
		numSpotLightMaps: 0,
		numSpotLightShadowsWithMaps: 0,
		numClippingPlanes: 0,
		numClipIntersection: 0,
		rendererExtensionParallelShaderCompile: false
	};

	const program = new WebGLProgram( renderer, 'mrt-qunit', parameters, {
		releaseStatesOfProgram: () => {}
	} );
	const source = context.calls.fragmentShaders[ context.calls.fragmentShaders.length - 1 ];
	program.destroy();

	return source;

}

function mappedLocation( shader, outputName ) {

	const alias = new RegExp( '^#define ' + outputName + ' (out_FragData\\d+)$', 'm' ).exec( shader );
	if ( alias === null ) return null;

	const declaration = new RegExp(
		'^layout\\( location = (\\d+) \\) out \\w+ (?:[iu]?vec4) ' + alias[ 1 ] + ';$', 'm'
	).exec( shader );

	return declaration === null ? null : Number( declaration[ 1 ] );

}

function cacheKey( cache, target ) {

	return cache.getProgramCacheKey( {
		shaderID: 'mrt-qunit',
		isRawShaderMaterial: false,
		renderTarget: target,
		customProgramCacheKey: ''
	} );

}

function createProgramCache() {

	return new WebGLPrograms( { outputColorSpace: LinearSRGBColorSpace }, null, null, {
		logarithmicDepthBuffer: false
	}, null, null );

}

function createTextureHarness( context ) {

	const properties = new WebGLProperties();
	const info = { memory: { textures: 0 } };
	const extensions = { has: () => false, get: () => null };
	const utils = {
		convert: ( value ) => {

			if ( value === RGBAFormat ) return context.gl.RGBA;
			if ( value === UnsignedByteType ) return context.gl.UNSIGNED_BYTE;
			throw new Error( 'Unsupported test texture format or type' );

		}
	};
	const textures = new WebGLTextures(
		context.gl, extensions, context.state, properties, {}, utils, info
	);

	return { properties, info, textures };

}

function createTarget( secondName = null ) {

	const target = new WebGLRenderTarget( 1, 1, { count: secondName === null ? 1 : 2, depthBuffer: false } );
	target.textures[ 0 ].name = 'Color';
	if ( secondName !== null ) target.textures[ 1 ].name = secondName;
	return target;

}

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'WebGL', () => {

		QUnit.module( 'WebGLMRTOutputs', () => {

			QUnit.test( 'single target retains location-zero red', ( assert ) => {

				const context = createContext();
				const target = createTarget();

				try {

					const shader = compileFragment( context, target );
					assert.strictEqual( mappedLocation( shader, 'gl_FragColor' ), 0, 'the red gl_FragColor branch maps to attachment zero' );
					assert.strictEqual( mappedLocation( shader, 'out_Color' ), null, 'single targets have no named MRT aliases' );

				} finally {

					target.dispose();

				}

			} );

			QUnit.test( 'second named MRT output writes green', ( assert ) => {

				const context = createContext();
				const target = createTarget( 'Second' );

				try {

					const shader = compileFragment( context, target );
					assert.strictEqual( mappedLocation( shader, 'gl_FragColor' ), 0, 'red remains at location zero' );
					assert.strictEqual( mappedLocation( shader, 'out_Second' ), 1, 'the green out_Second branch maps to location one' );
					assert.strictEqual( mappedLocation( shader, 'out_Color' ), 0, 'first named attachment maps to location zero' );

				} finally {

					target.dispose();

				}

			} );

			QUnit.test( 'renaming an attachment updates outputs on the same target', ( assert ) => {

				const context = createContext();
				const harness = createTextureHarness( context );
				const cache = createProgramCache();
				const target = createTarget( 'Second' );

				try {

					harness.textures.setupRenderTarget( target );

					const framebuffer = harness.properties.get( target ).__webglFramebuffer;
					const originalAttachment = framebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 );
					const originalKey = cacheKey( cache, target );

					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Second' ), 1, 'green before rename' );

					target.textures[ 1 ].name = 'Aux';
					const renamedKey = cacheKey( cache, target );
					assert.notStrictEqual( renamedKey, originalKey, 'the new output name invalidates the shader program key' );
					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Aux' ), 1, 'blue after rename' );
					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Second' ), null, 'old named output is removed' );
					assert.strictEqual( harness.textures.updateRenderTargetAttachments( target ), false, 'rename does not reallocate textures' );
					assert.strictEqual( framebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 ), originalAttachment, 'location-one GPU attachment is retained' );

					target.textures[ 1 ].name = 'Second';
					assert.strictEqual( cacheKey( cache, target ), originalKey, 'old program key is reusable' );
					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Second' ), 1, 'green after restoring name' );
					assert.strictEqual( harness.info.memory.textures, 2, 'both color attachments remain allocated' );

				} finally {

					target.dispose();

				}

			} );

			QUnit.test( 'replacing an attachment rebinds its GPU texture', ( assert ) => {

				const context = createContext();
				const harness = createTextureHarness( context );
				const cache = createProgramCache();
				const target = createTarget( 'Second' );

				try {

					harness.textures.setupRenderTarget( target );

					const oldFramebuffer = harness.properties.get( target ).__webglFramebuffer;
					const oldAttachment = oldFramebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 );
					const oldKey = cacheKey( cache, target );

					assert.ok( oldAttachment, 'first GPU texture was attached' );
					assert.strictEqual( harness.info.memory.textures, 2, 'two textures allocated initially' );

					const replacement = target.textures[ 1 ].clone();
					replacement.source = new TextureSource( { width: 1, height: 1, depth: 1 } );
					target.textures[ 1 ] = replacement;

					assert.notStrictEqual( cacheKey( cache, target ), oldKey, 'replacement invalidates program key even with the same name' );
					assert.strictEqual( harness.textures.updateRenderTargetAttachments( target ), true, 'texture identity change rebuilds framebuffer' );

					const newFramebuffer = harness.properties.get( target ).__webglFramebuffer;
					const newAttachment = newFramebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 );

					assert.notStrictEqual( newFramebuffer, oldFramebuffer, 'new framebuffer allocated' );
					assert.ok( newAttachment, 'replacement GPU texture exists' );
					assert.notStrictEqual( newAttachment, oldAttachment, 'location one uses replacement GPU texture' );
					assert.ok( context.calls.deletedTextures.includes( oldAttachment ), 'previous GPU texture freed' );
					assert.ok( context.calls.deletedFramebuffers.includes( oldFramebuffer ), 'previous framebuffer freed' );
					assert.strictEqual( harness.info.memory.textures, 2, 'no net GPU texture leak' );
					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Second' ), 1, 'replacement keeps green at location one' );

					replacement.name = 'Aux';
					assert.strictEqual( harness.textures.updateRenderTargetAttachments( target ), false, 'renaming replacement avoids GPU reallocation' );
					assert.strictEqual( mappedLocation( compileFragment( context, target ), 'out_Aux' ), 1, 'renamed replacement now maps blue' );
					assert.strictEqual( harness.properties.get( target ).__webglFramebuffer, newFramebuffer, 'framebuffer stays bound after rename' );

				} finally {

					target.dispose();

				}

				assert.strictEqual( harness.info.memory.textures, 0, 'disposal releases both current GPU textures' );

			} );

			QUnit.test( 'switching targets rebuilds named MRT outputs', ( assert ) => {

				const context = createContext();
				const harness = createTextureHarness( context );
				const cache = createProgramCache();
				const first = createTarget( 'Second' );
				const second = createTarget( 'Aux' );

				try {

					harness.textures.setupRenderTarget( first );
					harness.textures.setupRenderTarget( second );

					const firstShader = compileFragment( context, first );
					const secondShader = compileFragment( context, second );
					assert.notStrictEqual( cacheKey( cache, first ), cacheKey( cache, second ), 'distinct targets have distinct shader cache keys' );
					assert.strictEqual( mappedLocation( firstShader, 'out_Second' ), 1, 'first target maps the green output to location one' );
					assert.strictEqual( mappedLocation( firstShader, 'out_Aux' ), null, 'first target does not alias the blue output' );
					assert.strictEqual( mappedLocation( secondShader, 'out_Aux' ), 1, 'second target maps the blue output to location one' );
					assert.strictEqual( mappedLocation( secondShader, 'out_Second' ), null, 'second target does not alias the green output' );

					const firstFramebuffer = harness.properties.get( first ).__webglFramebuffer;
					const secondFramebuffer = harness.properties.get( second ).__webglFramebuffer;
					assert.notStrictEqual( firstFramebuffer, secondFramebuffer, 'targets use separate framebuffers' );
					assert.notStrictEqual(
						firstFramebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 ),
						secondFramebuffer.attachments.get( context.gl.COLOR_ATTACHMENT0 + 1 ),
						'location-one GPU attachments remain isolated'
					);

				} finally {

					first.dispose();
					second.dispose();

				}

			} );

		} );

	} );

} );
