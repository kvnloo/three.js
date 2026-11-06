import { Color, SRGBColorSpace } from 'three';

import { PLYLoader } from '../../../../examples/jsm/loaders/PLYLoader.js';

const positions = [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ];

function triangleHeader( format, type, onFace ) {

	const colors = [ 'red', 'green', 'blue' ].map( name => 'property ' + type + ' ' + name );

	return [
		'ply',
		'format ' + format + ' 1.0',
		'element vertex 3',
		'property float x',
		'property float y',
		'property float z',
		...( onFace ? [] : colors ),
		'element face 1',
		'property list uchar int vertex_indices',
		...( onFace ? colors : [] ),
		'end_header'
	].join( '\n' ) + '\n';

}

function asciiTriangle( type, rgb, onFace ) {

	const channels = rgb.join( ' ' );
	const body = positions.map( position => position.join( ' ' ) + ( onFace ? '' : ' ' + channels ) );

	body.push( '3 0 1 2' + ( onFace ? ' ' + channels : '' ) );

	return new PLYLoader().parse( triangleHeader( 'ascii', type, onFace ) + body.join( '\n' ) + '\n' );

}

function binaryTriangle( type, rgb, onFace, littleEndian ) {

	const format = littleEndian ? 'binary_little_endian' : 'binary_big_endian';
	const header = new TextEncoder().encode( triangleHeader( format, type, onFace ) );
	const componentSize = type === 'uchar' || type === 'uint8' ? 1 : type === 'ushort' || type === 'uint16' ? 2 : 4;
	const vertexBytes = 3 * ( 12 + ( onFace ? 0 : 3 * componentSize ) );
	const faceBytes = 13 + ( onFace ? 3 * componentSize : 0 );
	const data = new ArrayBuffer( header.byteLength + vertexBytes + faceBytes );

	new Uint8Array( data ).set( header );

	const view = new DataView( data );
	let offset = header.byteLength;

	function writeColor() {

		for ( const value of rgb ) {

			if ( componentSize === 1 ) {

				view.setUint8( offset, value );

			} else if ( componentSize === 2 ) {

				view.setUint16( offset, value, littleEndian );

			} else {

				view.setFloat32( offset, value, littleEndian );

			}

			offset += componentSize;

		}

	}

	for ( const position of positions ) {

		for ( const value of position ) {

			view.setFloat32( offset, value, littleEndian );
			offset += 4;

		}

		if ( ! onFace ) writeColor();

	}

	view.setUint8( offset, 3 );
	offset ++;

	for ( let index = 0; index < 3; index ++ ) {

		view.setInt32( offset, index, littleEndian );
		offset += 4;

	}

	if ( onFace ) writeColor();

	return new PLYLoader().parse( data );

}

function coloredTriangle( format, type, rgb, onFace ) {

	if ( format === 'ascii' ) return asciiTriangle( type, rgb, onFace );

	return binaryTriangle( type, rgb, onFace, format === 'binary_little_endian' );

}

function repeated( rgb ) {

	return [ ...rgb, ...rgb, ...rgb ];

}

const cases = [
	{ type: 'uchar', rgb: [ 10, 128, 200 ], expected: [ 1, 55, 147 ], arrayType: Uint8Array },
	{ type: 'uint8', rgb: [ 10, 128, 200 ], expected: [ 1, 55, 147 ], arrayType: Uint8Array },
	{ type: 'ushort', rgb: [ 10, 100, 1000 ], expected: [ 1, 8, 77 ], arrayType: Uint16Array },
	{ type: 'uint16', rgb: [ 10, 100, 1000 ], expected: [ 1, 8, 77 ], arrayType: Uint16Array },
	{
		type: 'float',
		rgb: [ 0.5, 0.25, 0.125 ],
		expected: new Color().setRGB( 0.5, 0.25, 0.125, SRGBColorSpace ).toArray(),
		arrayType: Float32Array
	}
];

export default QUnit.module( 'Addons', () => {

	QUnit.module( 'Loaders', () => {

		QUnit.module( 'PLYLoader', () => {

			for ( const format of [ 'ascii', 'binary_little_endian', 'binary_big_endian' ] ) {

				for ( const { type, rgb, expected, arrayType } of cases ) {

					QUnit.test( format + ' ' + type + ' face colors match vertex colors', ( assert ) => {

						const face = coloredTriangle( format, type, rgb, true ).getAttribute( 'color' );
						const vertex = coloredTriangle( format, type, rgb, false ).getAttribute( 'color' );
						const normalized = type !== 'float';
						const wanted = repeated( expected );

						assert.ok( face.array instanceof arrayType, 'face color attribute retains its source type' );
						assert.ok( vertex.array instanceof arrayType, 'vertex color attribute retains its source type' );
						assert.strictEqual( face.normalized, normalized, 'face color normalization' );
						assert.strictEqual( vertex.normalized, normalized, 'vertex color normalization' );
						assert.strictEqual( face.count, 3, 'one face produces three color vertices' );
						assert.strictEqual( vertex.count, 3, 'three colored source vertices' );

						if ( type === 'float' ) {

							for ( let i = 0; i < wanted.length; i ++ ) {

								assert.ok( Math.abs( face.array[ i ] - wanted[ i ] ) < 1e-6, 'face float channel ' + i + ' retains linear precision' );
								assert.ok( Math.abs( vertex.array[ i ] - wanted[ i ] ) < 1e-6, 'vertex float channel ' + i + ' retains linear precision' );

							}

						} else {

							assert.deepEqual( Array.from( vertex.array ), wanted, 'vertex reference rounds converted integer channels' );
							assert.deepEqual( Array.from( face.array ), wanted, 'face integer channels round to the same values' );

						}

					} );

				}

			}

		} );

	} );

} );
