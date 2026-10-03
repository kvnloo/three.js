import { Vector2 } from 'three';

/**
 * @module ReconstructionEvaluation
 * @three_import import * as ReconstructionEvaluation from 'three/addons/utils/ReconstructionEvaluation.js';
 */

function _finiteNonNegative( value, name ) {

	if ( typeof value !== 'number' || Number.isFinite( value ) === false || value < 0 ) {

		throw new Error( `${ name } must be a finite non-negative number.` );

	}

	return value;

}

function _percentileNearestRank( sorted, percentile ) {

	if ( sorted.length === 0 ) return null;

	const rank = Math.max( 1, Math.ceil( percentile * sorted.length ) );
	return sorted[ rank - 1 ];

}

/**
 * Summarizes frame durations without mixing them with upload timings.
 *
 * @param {Array<number>} frameTimesMs - Frame durations in milliseconds.
 * @return {{count:number,p50Ms:number|null,p95Ms:number|null,maxMs:number|null}} Summary.
 */
function summarizeFrameTimes( frameTimesMs ) {

	if ( Array.isArray( frameTimesMs ) === false ) {

		throw new Error( 'frameTimesMs must be an array.' );

	}

	const sorted = frameTimesMs.map( ( value, index ) => _finiteNonNegative( value, `frameTimesMs[${ index }]` ) ).sort( ( a, b ) => a - b );

	return {
		count: sorted.length,
		p50Ms: _percentileNearestRank( sorted, 0.50 ),
		p95Ms: _percentileNearestRank( sorted, 0.95 ),
		maxMs: sorted.length > 0 ? sorted[ sorted.length - 1 ] : null
	};

}

function _rendererBackend( renderer ) {

	if ( renderer && renderer.backend ) {

		if ( renderer.backend.isWebGPUBackend === true ) return 'webgpu';
		if ( renderer.backend.isWebGLBackend === true ) return 'webgl';

	}

	if ( renderer && renderer.isWebGPURenderer === true ) return 'webgpu';
	if ( renderer && renderer.isWebGLRenderer === true ) return 'webgl';
	return 'unknown';

}

function _cameraReceipt( camera ) {

	if ( camera === undefined || camera === null || camera.position === undefined || camera.quaternion === undefined || camera.projectionMatrix === undefined ) {

		throw new Error( 'camera must provide position, quaternion, and projectionMatrix.' );

	}

	const receipt = {
		type: camera.type || 'Camera',
		position: camera.position.toArray(),
		quaternion: camera.quaternion.toArray(),
		projectionMatrix: camera.projectionMatrix.toArray()
	};

	for ( const key of [ 'near', 'far', 'fov', 'aspect', 'zoom' ] ) {

		if ( typeof camera[ key ] === 'number' && Number.isFinite( camera[ key ] ) ) {

			receipt[ key ] = camera[ key ];

		}

	}

	return receipt;

}

/**
 * Creates a deterministic runtime receipt for one fixed-camera reconstruction render.
 *
 * Reconstruction-quality metrics intentionally do not belong here. They should be
 * supplied by the evaluator so runtime/detail performance cannot silently change
 * the reconstruction score.
 *
 * @param {Object} options - Receipt inputs.
 * @param {Object} options.renderer - Renderer-like object.
 * @param {Camera} options.camera - Camera used for the render.
 * @param {string} options.threeRevision - Exact Three.js revision.
 * @param {string} options.sceneRevision - Exact scene/model revision.
 * @param {Array<number>} [options.frameTimesMs=[]] - Frame durations.
 * @param {number} [options.uploadCount=0] - Texture/page uploads.
 * @param {number} [options.uploadTimeMs=0] - Aggregate upload time.
 * @param {number} [options.residentBytes=0] - Resident texture/atlas bytes.
 * @param {boolean} [options.virtualTexture=false] - Whether streamed detail is enabled.
 * @param {string|null} [options.screenshotSha256=null] - Hash computed from the captured screenshot.
 * @return {Object} Serializable receipt.
 */
function createReconstructionReceipt( {
	renderer,
	camera,
	threeRevision,
	sceneRevision,
	frameTimesMs = [],
	uploadCount = 0,
	uploadTimeMs = 0,
	residentBytes = 0,
	virtualTexture = false,
	screenshotSha256 = null
} ) {

	if ( typeof threeRevision !== 'string' || threeRevision.length === 0 ) {

		throw new Error( 'threeRevision must be a non-empty string.' );

	}

	if ( typeof sceneRevision !== 'string' || sceneRevision.length === 0 ) {

		throw new Error( 'sceneRevision must be a non-empty string.' );

	}

	if ( Number.isInteger( uploadCount ) === false || uploadCount < 0 ) {

		throw new Error( 'uploadCount must be a non-negative integer.' );

	}

	if ( typeof virtualTexture !== 'boolean' ) {

		throw new Error( 'virtualTexture must be a boolean.' );

	}

	if ( screenshotSha256 !== null && ( typeof screenshotSha256 !== 'string' || /^[0-9a-f]{64}$/.test( screenshotSha256 ) === false ) ) {

		throw new Error( 'screenshotSha256 must be null or a lowercase SHA-256 digest.' );

	}

	const viewport = new Vector2();

	if ( renderer === undefined || renderer === null || typeof renderer.getSize !== 'function' || typeof renderer.getPixelRatio !== 'function' ) {

		throw new Error( 'renderer must provide getSize() and getPixelRatio().' );

	}

	renderer.getSize( viewport );
	const dpr = renderer.getPixelRatio();

	_finiteNonNegative( viewport.x, 'viewport.width' );
	_finiteNonNegative( viewport.y, 'viewport.height' );
	_finiteNonNegative( dpr, 'dpr' );

	return {
		schemaVersion: 1,
		kind: 'three.reconstruction-runtime-receipt',
		threeRevision,
		sceneRevision,
		renderer: {
			backend: _rendererBackend( renderer ),
			viewport: {
				width: viewport.x,
				height: viewport.y,
				dpr
			}
		},
		camera: _cameraReceipt( camera ),
		frameTiming: summarizeFrameTimes( frameTimesMs ),
		uploads: {
			count: uploadCount,
			totalMs: _finiteNonNegative( uploadTimeMs, 'uploadTimeMs' )
		},
		residency: {
			bytes: _finiteNonNegative( residentBytes, 'residentBytes' )
		},
		virtualTexture,
		screenshotSha256
	};

}

export { createReconstructionReceipt, summarizeFrameTimes };
