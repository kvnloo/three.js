import { Line } from '../../../../src/objects/Line.js';

import { Object3D } from '../../../../src/core/Object3D.js';
import { BufferGeometry } from '../../../../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../../../../src/core/BufferAttribute.js';
import { Material } from '../../../../src/materials/Material.js';
import { Raycaster } from '../../../../src/core/Raycaster.js';
import { Vector3 } from '../../../../src/math/Vector3.js';

export default QUnit.module( 'Objects', () => {

	QUnit.module( 'Line', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const line = new Line();
			assert.strictEqual(
				line instanceof Object3D, true,
				'Line extends from Object3D'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const object = new Line();
			assert.ok( object, 'Can instantiate a Line.' );

		} );

		// PROPERTIES
		QUnit.test( 'type', ( assert ) => {

			const object = new Line();
			assert.ok(
				object.type === 'Line',
				'Line.type should be Line'
			);

		} );

		// PUBLIC
		QUnit.test( 'isLine', ( assert ) => {

			const object = new Line();
			assert.ok(
				object.isLine,
				'Line.isLine should be true'
			);

		} );

		QUnit.test( 'copy/material', ( assert ) => {

			// Material arrays are cloned
			const mesh1 = new Line();
			mesh1.material = [ new Material() ];

			const copy1 = mesh1.clone();
			assert.notStrictEqual( mesh1.material, copy1.material );

			// Non arrays are not cloned
			const mesh2 = new Line();
			mesh1.material = new Material();
			const copy2 = mesh2.clone();
			assert.strictEqual( mesh2.material, copy2.material );

		} );

		QUnit.test( 'copy/morphTargets', ( assert ) => {

			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );
			geometry.morphAttributes.position = [ new Float32BufferAttribute( [ 1, 0, 0, 0, 1, 0 ], 3 ) ];
			geometry.morphAttributes.position[ 0 ].name = 'target';

			const line = new Line( geometry );
			line.morphTargetInfluences[ 0 ] = 0.5;

			const copy = line.clone();
			assert.deepEqual( copy.morphTargetInfluences, [ 0.5 ], 'morphTargetInfluences are copied' );
			assert.notStrictEqual( copy.morphTargetInfluences, line.morphTargetInfluences, 'morphTargetInfluences are not shared' );
			assert.deepEqual( copy.morphTargetDictionary, { target: 0 }, 'morphTargetDictionary is copied' );
			assert.notStrictEqual( copy.morphTargetDictionary, line.morphTargetDictionary, 'morphTargetDictionary is not shared' );

		} );

		QUnit.test( 'raycast/parent scale uses world-space threshold', ( assert ) => {

			// Reproduction for hlfkyo's mrdoob/three.js#29679.
			// The ray is 0.75 world units from the line; the threshold is 0.5.
			const geometry = new BufferGeometry();
			geometry.setAttribute( 'position', new Float32BufferAttribute( [ - 1, 0, 0, 1, 0, 0 ], 3 ) );

			const parent = new Object3D();
			const line = new Line( geometry );
			parent.add( line );

			const raycaster = new Raycaster( new Vector3( 0, 0.75, 5 ), new Vector3( 0, 0, - 1 ) );
			raycaster.params.Line.threshold = 0.5;

			const cases = [
				{ scale: [ 1, 1, 1 ], label: 'identity parent' },
				{ scale: [ 2, 2, 2 ], label: 'uniformly scaled parent' },
				{ scale: [ 1, 4, 1 ], label: 'nonuniformly scaled parent' }
			];

			for ( const { scale, label } of cases ) {

				parent.scale.set( ...scale );
				parent.updateMatrixWorld( true );

				assert.strictEqual( raycaster.intersectObject( line, false ).length, 0,
					label + ': world-space distance 0.75 exceeds threshold 0.5' );

			}

		} );

	} );

} );
