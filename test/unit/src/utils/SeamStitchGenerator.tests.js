import { BufferGeometry } from '../../../../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../../../../src/core/BufferAttribute.js';
import { Mesh } from '../../../../src/objects/Mesh.js';
import { Texture } from '../../../../src/textures/Texture.js';

function triangle( positions, uv, normalZ = 1 ) {

	const geometry = new BufferGeometry();

	geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
	geometry.setAttribute( 'uv1', new Float32BufferAttribute( uv, 2 ) );
	geometry.setAttribute( 'normal', new Float32BufferAttribute( [
		0, 0, normalZ, 0, 0, normalZ, 0, 0, normalZ
	], 3 ) );

	return new Mesh( geometry );

}

async function fixture( samplesPerTexel, continuousUVs = false, normalZ = 1 ) {

	// Keep the import inside the test: on dev the missing addon fails each QUnit case,
	// rather than preventing the entire test suite from registering.
	const { SeamStitchGenerator } = await import( '../../../../examples/jsm/utils/SeamStitchGenerator.js' );

	const a = triangle(
		[ 0, 0, 0, 1, 0, 0, 0, 1, 0 ],
		[ 0, 0, 0.5, 0, 0.5, 0.5 ]
	);
	const b = triangle(
		[ 1, 0, 0, 1, 1, 0, 0, 1, 0 ],
		continuousUVs ?
			[ 0.5, 0, 1, 0.5, 0.5, 0.5 ] :
			[ 0, 0.5, 0.5, 0.5, 0, 1 ],
		normalZ
	);

	const coverage = new Texture();
	coverage.image = { width: 8, height: 8 };

	// Construction determines CPU seam topology; generating the map needs a GPU.
	const stitcher = new SeamStitchGenerator( null, [ a, b ], coverage, { samplesPerTexel } );

	return { stitcher, a, b, coverage };

}

function release( value ) {

	value.stitcher.dispose();

	for ( const mesh of [ value.a, value.b ] ) {

		mesh.geometry.dispose();
		mesh.material.dispose();

	}

	value.coverage.dispose();

}

function assertSamplingBounds( assert, system, size ) {

	const { weights, unknowns, texels, corners, fractions, ranges, entries } = system;

	assert.strictEqual( texels.length, unknowns, 'each unknown has one atlas texel' );
	assert.ok( unknowns <= size * size, 'no more unknowns than atlas texels' );
	assert.strictEqual( new Set( texels ).size, unknowns, 'atlas texels are unique' );
	assert.ok( Array.from( texels ).every( texel => texel < size * size ), 'all texels lie inside the atlas' );

	assert.strictEqual( corners.length, weights.length * 8, 'eight corners per constraint' );
	assert.strictEqual( fractions.length, weights.length * 4, 'four fractions per constraint' );
	assert.strictEqual( ranges.length, unknowns * 2, 'one entry range per unknown' );
	assert.ok( Array.from( corners ).every( corner => corner === - 1 || ( corner >= 0 && corner < unknowns ) ), 'corners are valid unknown indices or outside-atlas sentinels' );
	assert.ok( Array.from( fractions ).every( f => Number.isFinite( f ) && f >= 0 && f < 1 ), 'bilinear fractions stay within a texel' );
	assert.ok( Array.from( weights ).every( weight => Number.isFinite( weight ) && weight > 0 ), 'sample weights are finite and positive' );

	let end = 0;

	for ( let unknown = 0; unknown < unknowns; unknown ++ ) {

		const start = ranges[ unknown * 2 ];
		const count = ranges[ unknown * 2 + 1 ];

		assert.strictEqual( start, end, 'entry ranges are contiguous' );
		assert.ok( start + count <= entries.length, 'entry range does not exceed the buffer' );

		for ( let i = start; i < start + count; i ++ ) {

			const entry = entries[ i ];
			assert.ok( entry < corners.length, 'entry addresses an existing corner' );
			assert.strictEqual( corners[ entry ], unknown, 'entry points back to its unknown' );

		}

		end += count;

	}

	assert.strictEqual( end, entries.length, 'all entries are addressed by one unknown' );

}

QUnit.module( 'SeamStitchGenerator CPU seam topology', () => {

	QUnit.test( 'split chart: eight half-weight samples, 15 in-bounds texels', async ( assert ) => {

		const value = await fixture( 2 );

		try {

			const system = value.stitcher.seams;

			assert.strictEqual( system.weights.length, 8, '0.5 UV length times 8 texels times density 2' );
			assert.deepEqual( Array.from( system.weights ), Array( 8 ).fill( 0.5 ), 'each weight equals 4 / 8' );
			assert.strictEqual( system.unknowns, 15, '10 texels on one side and five on the other' );
			assert.deepEqual(
				Array.from( system.texels ).sort( ( a, b ) => a - b ),
				[ 3, 4, 11, 12, 19, 20, 24, 27, 28, 32, 35, 36, 40, 48, 56 ],
				'exact atlas boundary footprint'
			);

			assertSamplingBounds( assert, system, value.stitcher.size );

		} finally {

			release( value );

		}

	} );

	QUnit.test( 'density one gives four unit-weight samples', async ( assert ) => {

		const value = await fixture( 1 );

		try {

			const system = value.stitcher.seams;

			assert.strictEqual( system.weights.length, 4, '0.5 UV length times 8 texels times density 1' );
			assert.deepEqual( Array.from( system.weights ), [ 1, 1, 1, 1 ], 'each weight equals 4 / 4' );
			assertSamplingBounds( assert, system, value.stitcher.size );

		} finally {

			release( value );

		}

	} );

	QUnit.test( 'continuous UVs and opposing normals are not stitched', async ( assert ) => {

		const continuous = await fixture( 2, true );

		try {

			assert.strictEqual( continuous.stitcher.seams.weights.length, 0, 'shared UV edge has no discontinuity' );
			assert.strictEqual( continuous.stitcher.seams.unknowns, 0, 'continuous edge has no unknowns' );
			assertSamplingBounds( assert, continuous.stitcher.seams, continuous.stitcher.size );

		} finally {

			release( continuous );

		}

		const hardEdge = await fixture( 2, false, - 1 );

		try {

			assert.strictEqual( hardEdge.stitcher.seams.weights.length, 0, 'opposing normals are below threshold' );
			assert.strictEqual( hardEdge.stitcher.seams.unknowns, 0, 'hard edge has no unknowns' );
			assertSamplingBounds( assert, hardEdge.stitcher.seams, hardEdge.stitcher.size );

		} finally {

			release( hardEdge );

		}

	} );

} );
