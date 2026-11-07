import { Texture } from './Texture.js';

/**
 * Represents a texture created externally with the same renderer context.
 *
 * This may be a texture from a protected media stream, device camera feed,
 * or other data feeds like a depth sensor.
 *
 * @augments Texture
 */
class ExternalTexture extends Texture {

	/**
	 * Creates a new raw texture.
	 *
	 * @param {?(WebGLTexture|GPUTexture)} [sourceTexture=null] - The external texture.
	 */
	constructor( sourceTexture = null ) {

		super();

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isExternalTexture = true;

		this.sourceTexture = sourceTexture;

	}

	/**
	 * The externally owned GPU texture or WebGL texture handle.
	 * GPUTexture dimensions are reflected in the image for render-target sizing.
	 *
	 * @type {?(WebGLTexture|GPUTexture)}
	 */
	get sourceTexture() {

		return this._sourceTexture;

	}

	set sourceTexture( value ) {

		if ( this._sourceTexture === value ) return;

		this._sourceTexture = value;

		if ( value !== null && value !== undefined && typeof value.width === 'number' ) {

			this.image = { width: value.width, height: value.height, depth: value.depthOrArrayLayers || 1 };
			this.isArrayTexture = this.image.depth > 1;

		} else {

			this.image = null;
			this.isArrayTexture = false;

		}

		this.needsUpdate = true;

	}

	copy( source ) {

		super.copy( source );

		this.sourceTexture = source.sourceTexture;

		return this;

	}

}

export { ExternalTexture };
