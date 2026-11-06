import NodeBuilder from '../../../../../src/nodes/core/NodeBuilder.js';
import TextureNode from '../../../../../src/nodes/accessors/TextureNode.js';
import {
	DataTexture, Mesh, MeshBasicNodeMaterial, OrthographicCamera,
	PlaneGeometry, RenderTarget, Scene, WebGPURenderer
} from '../../../../../src/Three.WebGPU.js';
import { Fn, int, ivec2, positionLocal, textureLoad, vec4 } from '../../../../../src/Three.TSL.js';

class LayoutUniformBuilder extends NodeBuilder {

	constructor( renderer, textures ) {

		super( null, renderer, null );

		this.textures = textures;
		this.functionBuilds = 0;

	}

	buildFunctionCode() {

		this.functionBuilds ++;

		this.textures.forEach( ( node, index ) => {

			this.getUniformFromNode( node, 'texture', this.shaderStage, 'nodeUniform' + index );

		} );

		return 'fn sample() -> f32 { return 1.0; }';

	}

}

const createRenderer = ( backend = {} ) => ( {
	backend,
	debug: { diagnostics: { keywords: false } }
} );

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'TSL', () => {

		QUnit.module( 'TSLLayoutUniforms', () => {

			QUnit.test( 'one function registers a texture in both shader stages', ( assert ) => {

				const builder = new LayoutUniformBuilder( createRenderer(), [ new TextureNode() ] );
				const shaderNode = {};

				builder.setShaderStage( 'vertex' );
				const vertexFunction = builder.buildFunctionNode( shaderNode );

				assert.deepEqual( builder.uniforms.vertex.map( uniform => uniform.name ), [ 'nodeUniform0' ], 'vertex texture declaration' );

				builder.setShaderStage( 'fragment' );
				const fragmentFunction = builder.buildFunctionNode( shaderNode );

				assert.strictEqual( fragmentFunction, vertexFunction, 'cached function identity is reused' );
				assert.deepEqual( builder.uniforms.fragment.map( uniform => uniform.name ), [ 'nodeUniform0' ], 'fragment texture declaration' );
				assert.strictEqual( builder.functionBuilds, 1, 'function code generated once' );

			} );

			QUnit.test( 'two textures replay once per stage across repeat calls', ( assert ) => {

				const builder = new LayoutUniformBuilder( createRenderer(), [ new TextureNode(), new TextureNode() ] );
				const shaderNode = {};

				builder.setShaderStage( 'vertex' );
				builder.buildFunctionNode( shaderNode );

				builder.setShaderStage( 'fragment' );
				builder.buildFunctionNode( shaderNode );
				builder.buildFunctionNode( shaderNode );

				assert.deepEqual( builder.uniforms.vertex.map( uniform => uniform.name ), [ 'nodeUniform0', 'nodeUniform1' ], 'two vertex declarations' );
				assert.deepEqual( builder.uniforms.fragment.map( uniform => uniform.name ), [ 'nodeUniform0', 'nodeUniform1' ], 'two fragment declarations, no duplicates' );
				assert.strictEqual( builder.functionBuilds, 1, 'function is compiled once' );

			} );

			QUnit.test( 'another builder on the same backend replays cached dependencies', ( assert ) => {

				const renderer = createRenderer();
				const textures = [ new TextureNode() ];
				const shaderNode = {};
				const first = new LayoutUniformBuilder( renderer, textures );
				const second = new LayoutUniformBuilder( renderer, textures );

				first.setShaderStage( 'vertex' );
				const cached = first.buildFunctionNode( shaderNode );
				assert.deepEqual( first.uniforms.vertex.map( uniform => uniform.name ), [ 'nodeUniform0' ], 'initial builder registers the texture' );

				second.setShaderStage( 'fragment' );
				const reused = second.buildFunctionNode( shaderNode );
				second.buildFunctionNode( shaderNode );

				assert.strictEqual( reused, cached, 'function cache is shared by builders on one backend' );
				assert.strictEqual( second.functionBuilds, 0, 'second builder does not compile the function' );
				assert.deepEqual( second.uniforms.fragment.map( uniform => uniform.name ), [ 'nodeUniform0' ], 'second builder gets exactly one fragment declaration' );
				assert.strictEqual( first.uniforms.fragment.length, 0, 'first builder stage declarations stay isolated' );

			} );

			QUnit.test( 'different backends retain separate function caches', ( assert ) => {

				const shaderNode = {};
				const textures = [ new TextureNode() ];
				const first = new LayoutUniformBuilder( createRenderer(), textures );
				const second = new LayoutUniformBuilder( createRenderer(), textures );

				first.setShaderStage( 'vertex' );
				second.setShaderStage( 'fragment' );

				const firstFunction = first.buildFunctionNode( shaderNode );
				const secondFunction = second.buildFunctionNode( shaderNode );

				assert.notStrictEqual( firstFunction, secondFunction, 'each backend owns its own cached function' );
				assert.strictEqual( first.functionBuilds, 1, 'first backend compiles its function' );
				assert.strictEqual( second.functionBuilds, 1, 'second backend compiles independently' );
				assert.deepEqual( second.uniforms.fragment.map( uniform => uniform.name ), [ 'nodeUniform0' ], 'second backend registers its own texture' );

			} );

			QUnit.test( 'native WebGPU renders a DataTexture layout function in vertex and fragment', async ( assert ) => {

				const renderer = new WebGPURenderer( { antialias: false } );
				const texture = new DataTexture( new Uint8Array( [ 255, 128, 0, 255 ] ), 1, 1 );
				texture.needsUpdate = true;

				const readTexel = Fn( ( [ i ] ) => textureLoad( texture, ivec2( i, int( 0 ) ) ) ).setLayout( {
					name: 'readTexel',
					type: 'vec4',
					inputs: [ { name: 'i', type: 'int' } ]
				} );

				const material = new MeshBasicNodeMaterial();
				material.positionNode = positionLocal.mul( readTexel( int( 0 ) ).x );
				material.colorNode = vec4( readTexel( int( 0 ) ) );

				const geometry = new PlaneGeometry( 2, 2 );
				const mesh = new Mesh( geometry, material );
				const scene = new Scene();
				scene.add( mesh );

				const camera = new OrthographicCamera( - 1, 1, 1, - 1, 0.1, 10 );
				camera.position.z = 1;

				const target = new RenderTarget( 4, 4, { depthBuffer: false } );

				try {

					await renderer.init();
					assert.true( renderer.backend.isWebGPUBackend, 'requires native WebGPU, not WebGL fallback' );

					renderer.setRenderTarget( target );
					renderer.render( scene, camera );

					const pixel = await renderer.readRenderTargetPixelsAsync( target, 2, 2, 1, 1 );

					assert.strictEqual( pixel.length, 4, 'one RGBA texel was read back' );
					assert.true( pixel[ 0 ] >= 240, 'the red channel comes from the DataTexture' );
					assert.true( pixel[ 1 ] >= 110 && pixel[ 1 ] <= 220, 'green channel comes from the DataTexture, allowing output transfer' );
					assert.true( pixel[ 2 ] <= 12, 'blue channel remains zero' );
					assert.true( pixel[ 3 ] >= 240, 'the mesh renders opaquely' );

				} finally {

					target.dispose();
					geometry.dispose();
					material.dispose();
					texture.dispose();
					await renderer.dispose();

				}

			} );

		} );

	} );

} );
