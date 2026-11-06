import { CubeTexture } from './CubeTexture.js';

/**
 * A WebGPU texture containing multiple cube maps.
 *
 * For image-backed textures, provide an array of cubes, each containing six
 * images ordered like CubeTexture (positive/negative X, Y, and Z). When the
 * texture is copied from a layered render target, image.depth is instead the
 * total face-layer count: six layers per cube.
 *
 * Use cubeTexture( texture, direction ).depth( cubeIndex ) to sample one cube.
 * Cube arrays are only supported by WebGPURenderer with the WebGPU backend.
 *
 * @augments CubeTexture
 */
class CubeArrayTexture extends CubeTexture {

	/**
	 * Constructs a cube array texture from an array of six-face image arrays.
	 *
	 * An empty array is also valid for an uninitialized or render-target texture.
	 *
	 * @param {Array<Array<Image>>} [images=[]] - One array of six face images per cube.
	 */
	constructor( images = [] ) {

		if ( ! Array.isArray( images ) || images.some( ( cube ) => ! Array.isArray( cube ) || cube.length !== 6 ) ) {

			throw new TypeError( 'CubeArrayTexture: Expected an array of six-face image arrays.' );

		}

		super( images );

		/**
		 * Identifies this texture as a cube array.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isCubeArrayTexture = true;

		// Cube array textures are arrayed as well as cubical.
		// Keeping both flags enables cube sampling and a default array index.
		this.isArrayTexture = true;

	}

}

export { CubeArrayTexture };
