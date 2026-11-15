import { Line2 } from '../../../../examples/jsm/lines/Line2.js';
import { LineGeometry } from '../../../../examples/jsm/lines/LineGeometry.js';
import { LineSegmentsGeometry } from '../../../../examples/jsm/lines/LineSegmentsGeometry.js';

export default QUnit.module( 'Addons', () => {

	QUnit.module( 'Lines', () => {

		QUnit.module( 'LineSegmentsGeometry', () => {

			QUnit.test( 'toJSON preserves instanced line data', ( assert ) => {

				const geometry = new LineSegmentsGeometry();
				geometry.setPositions( [ 0, 0, 0, 2, 0, 0 ] );

				const json = geometry.toJSON();

				assert.strictEqual( json.type, 'LineSegmentsGeometry' );
				assert.true( json.isInstancedBufferGeometry );
				assert.strictEqual( json.instanceCount, 1 );

				const start = json.data.attributes.instanceStart;
				const end = json.data.attributes.instanceEnd;

				assert.true( start.isInterleavedBufferAttribute );
				assert.strictEqual( start.offset, 0 );
				assert.strictEqual( end.offset, 3 );
				assert.strictEqual( start.data, end.data, 'both endpoints share the same buffer' );

				const buffer = json.data.interleavedBuffers[ start.data ];

				assert.strictEqual( buffer.stride, 6 );
				assert.deepEqual( json.data.arrayBuffers[ buffer.buffer ], [ 0, 0, 0, 1073741824, 0, 0 ], 'serializes six float32 components' );
				assert.strictEqual( json.data.boundingSphere.radius, 1 );

			} );

			QUnit.test( 'Line2.toJSON includes wide-line geometry', ( assert ) => {

				const geometry = new LineGeometry();
				geometry.setPositions( [ 0, 0, 0, 2, 0, 0, 2, 1, 0 ] );

				const line = new Line2( geometry );
				const json = line.toJSON();

				assert.strictEqual( json.object.geometry, geometry.uuid );
				assert.strictEqual( json.geometries.length, 1 );
				assert.strictEqual( json.geometries[ 0 ].type, 'LineGeometry' );
				assert.strictEqual( json.geometries[ 0 ].instanceCount, 2 );
				assert.true( json.geometries[ 0 ].data.attributes.instanceStart.isInterleavedBufferAttribute );
				assert.true( JSON.stringify( line ).includes( '"instanceStart"' ), 'JSON.stringify can serialize a Line2' );

			} );

		} );

	} );

} );
