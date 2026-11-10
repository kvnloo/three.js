import { HalfFloatType, LinearFilter, LinearMipmapLinearFilter, NearestFilter, NodeMaterial, QuadMesh, RendererUtils, RenderTarget } from 'three/webgpu';
import { Fn, If, float, ivec2, max, screenCoordinate, texture, vec2, vec4 } from 'three/tsl';

const _quadMesh = /*@__PURE__*/ new QuadMesh();

let _rendererState;

/**
 * Fills the gutters of a baked map: the texels outside the charts of a UV atlas, e.g. of a light map or an
 * ambient occlusion map. Texture filtering reads texels on both sides of the border of a chart, and the mip
 * levels of a map average whole blocks of texels, so empty gutters show up as dark outlines around the
 * charts, the more the farther away the map is seen. This fills every texel outside the charts with the
 * values of the nearest charts: a push-pull pass halves the map down to one texel, averaging the covered
 * texels, and then fills the uncovered texels of each level from the level below, smoothly upsampled.
 * The covered texels keep their values.
 *
 * ```js
 * const gutterFill = new GutterFillGenerator( renderer, { generateMipmaps: true } );
 *
 * material.lightMap = gutterFill.generate( lightMapper.texture, lightMapper.getTexture( 'coverage' ) );
 * ```
 *
 * This class can only be used with {@link WebGPURenderer}.
 *
 * @three_import import { GutterFillGenerator } from 'three/addons/utils/GutterFillGenerator.js';
 */
class GutterFillGenerator {

	/**
	 * Constructs a new gutter fill generator.
	 *
	 * @param {WebGPURenderer} renderer - The renderer.
	 * @param {Object} [options] - The options.
	 * @param {boolean} [options.generateMipmaps=false] - Whether the filled map has mipmaps.
	 */
	constructor( renderer, { generateMipmaps = false } = {} ) {

		/**
		 * The renderer.
		 *
		 * @type {WebGPURenderer}
		 */
		this.renderer = renderer;

		/**
		 * Whether the filled map has mipmaps.
		 *
		 * @type {boolean}
		 * @readonly
		 */
		this.generateMipmaps = generateMipmaps;

		// the levels below the map, each one with the averages of the covered texels of the level above
		// and whether any of them is covered in alpha ( push ), and with all texels filled ( pull )

		this._levels = [];
		this._renderTarget = null;
		this._output = null;

		this._map = null;
		this._coverage = null;

	}

	/**
	 * The filled map of the last call of {@link GutterFillGenerator#generate}, or `null` before.
	 *
	 * @type {?Texture}
	 * @readonly
	 */
	get texture() {

		return this._renderTarget !== null ? this._renderTarget.texture : null;

	}

	/**
	 * Fills the gutters of a map. The result is owned by the generator and reused by its next call.
	 *
	 * @param {Texture} map - The map.
	 * @param {Texture} [coverage=map] - A texture of the size of the map whose alpha is above zero at covered texels, e.g. the
	 * coverage of {@link LightMapper#getTexture}, or the stitched map of {@link SeamStitchGenerator}.
	 * @return {Texture} The filled map, with the UV channel of the map.
	 */
	generate( map, coverage = map ) {

		const renderer = this.renderer;

		this._setSize( map.image.width, map.image.height, map );

		this._map.value = map;
		this._coverage.value = coverage;
		this._renderTarget.texture.channel = map.channel;

		_rendererState = RendererUtils.resetRendererState( renderer, _rendererState );

		// push: each level averages the covered texels of the level above, then pull: the uncovered texels of each
		// level take the upsampled values of the level below

		const levels = this._levels;

		for ( let i = 0; i < levels.length; i ++ ) {

			_quadMesh.material = levels[ i ].pushMaterial;
			renderer.setRenderTarget( levels[ i ].push );
			_quadMesh.render( renderer );

		}

		for ( let i = levels.length - 2; i >= 0; i -- ) {

			_quadMesh.material = levels[ i ].pullMaterial;
			renderer.setRenderTarget( levels[ i ].pull );
			_quadMesh.render( renderer );

		}

		_quadMesh.material = this._output;
		renderer.setRenderTarget( this._renderTarget );
		_quadMesh.render( renderer );

		RendererUtils.restoreRendererState( renderer, _rendererState );

		return this._renderTarget.texture;

	}

	/**
	 * Frees all internal resources.
	 */
	dispose() {

		this._disposeTargets();

	}

	/**
	 * Creates the targets and materials of a map size.
	 *
	 * @private
	 * @param {number} width - The width of the map.
	 * @param {number} height - The height of the map.
	 * @param {Texture} map - The map, for the initial values of the texture nodes.
	 */
	_setSize( width, height, map ) {

		const target = this._renderTarget;

		if ( target !== null && target.width === width && target.height === height ) return;

		this._disposeTargets();

		this._renderTarget = new RenderTarget( width, height, { type: HalfFloatType, depthBuffer: false, generateMipmaps: this.generateMipmaps, minFilter: this.generateMipmaps ? LinearMipmapLinearFilter : LinearFilter } );

		this._map = texture( map );
		this._coverage = texture( map );

		// the push targets are read texel by texel, the pull targets are upsampled with filtering. The smallest
		// level has nothing below it, so its push target is its pull target too

		const levels = this._levels;
		let w = width, h = height;

		while ( w > 1 || h > 1 ) {

			w = Math.max( 1, Math.ceil( w / 2 ) );
			h = Math.max( 1, Math.ceil( h / 2 ) );

			levels.push( {
				width: w,
				height: h,
				push: new RenderTarget( w, h, { type: HalfFloatType, depthBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter } ),
				pull: null
			} );

		}

		for ( let i = 0; i < levels.length; i ++ ) {

			const level = levels[ i ];

			if ( i < levels.length - 1 ) level.pull = new RenderTarget( level.width, level.height, { type: HalfFloatType, depthBuffer: false } );

		}

		// a texel of the map with a coverage of 1 or 0, and a texel of a push level with its coverage in alpha

		const mapTexel = ( coord ) => vec4( this._map.load( coord ).rgb, this._coverage.load( coord ).a.greaterThan( 0 ).select( float( 1 ), float( 0 ) ) );
		const levelTexel = ( source ) => ( coord ) => source.load( coord );

		const below = ( i ) => {

			const level = levels[ i ];
			return texture( level.pull !== null ? level.pull.texture : level.push.texture );

		};

		for ( let i = 0; i < levels.length; i ++ ) {

			const level = levels[ i ];
			const above = i === 0 ? { texel: mapTexel, width, height } : { texel: levelTexel( texture( levels[ i - 1 ].push.texture ) ), width: levels[ i - 1 ].width, height: levels[ i - 1 ].height };

			level.pushMaterial = createMaterial( push( above.texel, above.width, above.height ) );
			if ( level.pull !== null ) level.pullMaterial = createMaterial( pull( levelTexel( texture( level.push.texture ) ), below( i + 1 ), level.width, level.height ) );

		}

		this._output = createMaterial( levels.length > 0 ? pull( mapTexel, below( 0 ), width, height ) : Fn( () => vec4( mapTexel( ivec2( screenCoordinate.xy ) ).rgb, 1 ) )() );

	}

	/**
	 * Frees the render targets and materials.
	 *
	 * @private
	 */
	_disposeTargets() {

		if ( this._renderTarget !== null ) this._renderTarget.dispose();
		if ( this._output !== null ) this._output.dispose();

		for ( const level of this._levels ) {

			level.push.dispose();
			level.pushMaterial.dispose();

			if ( level.pull !== null ) {

				level.pull.dispose();
				level.pullMaterial.dispose();

			}

		}

		this._renderTarget = null;
		this._output = null;
		this._levels = [];

	}

}

/**
 * Returns a node for the average of the covered texels of the 2x2 texels of the level above a texel, and whether
 * any of them is covered in alpha.
 *
 * @private
 * @param {function(Node<ivec2>): Node<vec4>} texel - Reads a texel of the level above, with its coverage in alpha.
 * @param {number} width - The width of the level above.
 * @param {number} height - The height of the level above.
 * @return {Node<vec4>} The node.
 */
function push( texel, width, height ) {

	return Fn( () => {

		const coord = ivec2( screenCoordinate.xy );
		const sum = vec4( 0 ).toVar();

		for ( let y = 0; y < 2; y ++ ) {

			for ( let x = 0; x < 2; x ++ ) {

				const above = coord.mul( 2 ).add( ivec2( x, y ) ).toVar();

				If( above.x.lessThan( width ).and( above.y.lessThan( height ) ), () => {

					const value = texel( above ).toVar();
					sum.addAssign( vec4( value.rgb.mul( value.a ), value.a ) );

				} );

			}

		}

		return vec4( sum.rgb.div( max( sum.a, 1e-8 ) ), sum.a.greaterThan( 0 ).select( float( 1 ), float( 0 ) ) );

	} )();

}

/**
 * Returns a node that keeps a covered texel and fills an uncovered one from the level below, upsampled with filtering.
 *
 * @private
 * @param {function(Node<ivec2>): Node<vec4>} texel - Reads a texel of the level, with its coverage in alpha.
 * @param {TextureNode} below - The filled level below.
 * @param {number} width - The width of the level.
 * @param {number} height - The height of the level.
 * @return {Node<vec4>} The node.
 */
function pull( texel, below, width, height ) {

	return Fn( () => {

		const coord = ivec2( screenCoordinate.xy );
		const value = texel( coord ).toVar();
		const filled = below.sample( vec2( coord ).add( 0.5 ).div( vec2( width, height ) ) ).rgb;

		return vec4( value.a.greaterThan( 0 ).select( value.rgb, filled ), 1 );

	} )();

}

/**
 * Creates the material of a full-screen pass.
 *
 * @private
 * @param {Node<vec4>} fragmentNode - The output of the pass.
 * @return {NodeMaterial} The material.
 */
function createMaterial( fragmentNode ) {

	const material = new NodeMaterial();
	material.fragmentNode = fragmentNode;
	return material;

}

export { GutterFillGenerator };
