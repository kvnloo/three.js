import { CameraHelper } from '../../../../src/helpers/CameraHelper.js';

import { LineSegments } from '../../../../src/objects/LineSegments.js';
import { PerspectiveCamera } from '../../../../src/cameras/PerspectiveCamera.js';
import { Scene } from '../../../../src/scenes/Scene.js';

export default QUnit.module( 'Helpers', () => {

	QUnit.module( 'CameraHelper', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const camera = new PerspectiveCamera();
			const object = new CameraHelper( camera );
			assert.strictEqual(
				object instanceof LineSegments, true,
				'CameraHelper extends from LineSegments'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const camera = new PerspectiveCamera();
			const object = new CameraHelper( camera );
			assert.ok( object, 'Can instantiate a CameraHelper.' );

		} );

		// PROPERTIES
		QUnit.test( 'type', ( assert ) => {

			const camera = new PerspectiveCamera();
			const object = new CameraHelper( camera );
			assert.ok(
				object.type === 'CameraHelper',
				'CameraHelper.type should be CameraHelper'
			);

		} );

		// PUBLIC

		QUnit.test( 'clone', ( assert ) => {

			const camera = new PerspectiveCamera( 60, 1.5, 0.5, 25 );
			const helper = new CameraHelper( camera );
			const cloned = helper.clone();

			assert.ok( cloned instanceof CameraHelper, 'clone is a CameraHelper' );
			assert.notStrictEqual( cloned, helper, 'clone is a different object' );
			assert.strictEqual( cloned.camera, camera, 'clone retains the camera reference' );
			assert.strictEqual( cloned.matrix, camera.matrixWorld, 'clone tracks the camera world matrix' );
			assert.notStrictEqual( cloned.geometry, helper.geometry, 'clone has independent geometry' );
			assert.notStrictEqual( cloned.material, helper.material, 'clone has independent material' );
			assert.strictEqual( cloned.geometry.getAttribute( 'position' ).count, 50, 'all 25 frustum lines have two endpoints' );
			assert.deepEqual(
				Array.from( cloned.geometry.getAttribute( 'position' ).array ),
				Array.from( helper.geometry.getAttribute( 'position' ).array ),
				'cloned frustum positions match'
			);

			const originalRed = helper.geometry.getAttribute( 'color' ).getX( 0 );
			cloned.geometry.getAttribute( 'color' ).setX( 0, 0.25 );
			assert.strictEqual( helper.geometry.getAttribute( 'color' ).getX( 0 ), originalRed, 'editing clone colors does not change the original' );
			cloned.update();

		} );

		QUnit.test( 'clone (scene hierarchy)', ( assert ) => {

			const camera = new PerspectiveCamera();
			const helper = new CameraHelper( camera );
			helper.name = 'frustum';

			const scene = new Scene();
			scene.add( camera, helper );

			const clonedScene = scene.clone();
			const clonedHelper = clonedScene.getObjectByName( 'frustum' );

			assert.ok( clonedHelper instanceof CameraHelper, 'scene.clone() retains the camera helper' );
			assert.notStrictEqual( clonedHelper.geometry, helper.geometry, 'scene clone has independent helper geometry' );

		} );

		QUnit.test( 'dispose', ( assert ) => {

			assert.expect( 0 );

			const camera = new PerspectiveCamera();
			const object = new CameraHelper( camera );
			object.dispose();

		} );

	} );

} );
