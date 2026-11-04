import { Camera } from '../../../../src/cameras/Camera.js';

import { Vector3 } from '../../../../src/math/Vector3.js';
import { Object3D } from '../../../../src/core/Object3D.js';

function assertScaledViewMatrix( assert, camera, scale, expectedPosition, context ) {

	const epsilon = 1e-10;
	const worldPosition = new Vector3().setFromMatrixPosition( camera.matrixWorld );
	const worldScale = new Vector3().setFromMatrixScale( camera.matrixWorld );
	const viewScale = new Vector3().setFromMatrixScale( camera.matrixWorldInverse );

	assert.ok( worldPosition.distanceTo( expectedPosition ) < epsilon, context + ': world position retains parent scale' );
	assert.ok( worldScale.distanceTo( scale ) < epsilon, context + ': world transform retains parent scale' );
	assert.ok( viewScale.distanceTo( new Vector3( 1, 1, 1 ) ) < epsilon, context + ': view matrix has unit scale' );

	// A 90-degree Y rotation makes the camera look toward world -X.
	const direction = camera.getWorldDirection( new Vector3() );
	assert.ok( direction.distanceTo( new Vector3( - 1, 0, 0 ) ) < epsilon, context + ': world direction is -X' );

	const ahead = expectedPosition.clone().add( new Vector3( - 1, 0, 0 ) );
	assert.ok( ahead.applyMatrix4( camera.matrixWorldInverse ).distanceTo( new Vector3( 0, 0, - 1 ) ) < epsilon,
		context + ': a point one world unit ahead is one view unit ahead' );

	// Column-major R_y(-90 degrees) with inverse translation (-R_y(-90) * expectedPosition).
	const expectedViewElements = [
		0, 0, 1, 0,
		0, 1, 0, 0,
		- 1, 0, 0, 0,
		3, - expectedPosition.y, - expectedPosition.x, 1
	];

	for ( let i = 0; i < expectedViewElements.length; i ++ ) {

		assert.ok( Math.abs( camera.matrixWorldInverse.elements[ i ] - expectedViewElements[ i ] ) < epsilon,
			context + ': view matrix element ' + i + ' ignores scale' );

	}

}

export default QUnit.module( 'Cameras', () => {

	QUnit.module( 'Camera', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const object = new Camera();
			assert.strictEqual(
				object instanceof Object3D, true,
				'Camera extends from Object3D'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const object = new Camera();
			assert.ok( object, 'Can instantiate a Camera.' );

		} );

		// PROPERTIES
		QUnit.test( 'type', ( assert ) => {

			const object = new Camera();
			assert.ok(
				object.type === 'Camera',
				'Camera.type should be Camera'
			);

		} );

		// PUBLIC
		QUnit.test( 'isCamera', ( assert ) => {

			const object = new Camera();
			assert.ok(
				object.isCamera,
				'Camera.isCamera should be true'
			);

		} );

		QUnit.test( 'clone', ( assert ) => {

			const cam = new Camera();

			// fill the matrices with any nonsense values just to see if they get copied
			cam.matrixWorldInverse.set( 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 );
			cam.projectionMatrix.set( 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 );

			const clonedCam = cam.clone();

			// TODO: do not rely equality on object methods
			// TODO: What's append if matrix.equal is wrongly implemented
			// TODO: this MUST be check by assert
			assert.ok( cam.matrixWorldInverse.equals( clonedCam.matrixWorldInverse ), 'matrixWorldInverse is equal' );
			assert.ok( cam.projectionMatrix.equals( clonedCam.projectionMatrix ), 'projectionMatrix is equal' );

		} );

		QUnit.test( 'updateMatrixWorld (scaled parent)', ( assert ) => {

			for ( const { name, scale, expectedPosition } of [
				{ name: 'uniform', scale: new Vector3( 2, 2, 2 ), expectedPosition: new Vector3( 9, 8, 3 ) },
				{ name: 'non-uniform', scale: new Vector3( 2, 3, 4 ), expectedPosition: new Vector3( 15, 10, 3 ) }
			] ) {

				const parent = new Object3D();
				parent.position.set( 3, 4, 5 );
				parent.rotation.y = Math.PI / 2;
				parent.scale.copy( scale );

				const camera = new Camera();
				camera.position.set( 1, 2, 3 );
				parent.add( camera );

				parent.updateMatrixWorld();
				camera.updateMatrixWorld();

				assertScaledViewMatrix( assert, camera, scale, expectedPosition, name );

			}

		} );

		QUnit.test( 'updateWorldMatrix (scaled parent)', ( assert ) => {

			for ( const { name, scale, expectedPosition } of [
				{ name: 'uniform', scale: new Vector3( 2, 2, 2 ), expectedPosition: new Vector3( 9, 8, 3 ) },
				{ name: 'non-uniform', scale: new Vector3( 2, 3, 4 ), expectedPosition: new Vector3( 15, 10, 3 ) }
			] ) {

				const parent = new Object3D();
				parent.position.set( 3, 4, 5 );
				parent.rotation.y = Math.PI / 2;
				parent.scale.copy( scale );

				const camera = new Camera();
				camera.position.set( 1, 2, 3 );
				parent.add( camera );

				camera.updateWorldMatrix( true, false );

				assertScaledViewMatrix( assert, camera, scale, expectedPosition, name );

			}

		} );

		// OTHERS
		// TODO: this should not be here, Object3D related
		QUnit.test( 'lookAt', ( assert ) => {

			const cam = new Camera();
			cam.lookAt( new Vector3( 0, 1, - 1 ) );

			assert.numEqual( cam.rotation.x * ( 180 / Math.PI ), 45, 'x is equal' );

		} );

	} );

} );
