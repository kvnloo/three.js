import { ObjectLoader } from '../../../../src/loaders/ObjectLoader.js';

import { Loader } from '../../../../src/loaders/Loader.js';
import { Object3D } from '../../../../src/core/Object3D.js';
import { OrthographicCamera } from '../../../../src/cameras/OrthographicCamera.js';
import { PerspectiveCamera } from '../../../../src/cameras/PerspectiveCamera.js';
import { Sprite } from '../../../../src/objects/Sprite.js';
import { Vector3 } from '../../../../src/math/Vector3.js';
import { eps } from '../../utils/math-constants.js';

export default QUnit.module( 'Loaders', () => {

	QUnit.module( 'ObjectLoader', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const object = new ObjectLoader();
			assert.strictEqual(
				object instanceof Loader, true,
				'ObjectLoader extends from Loader'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const object = new ObjectLoader();
			assert.ok( object, 'Can instantiate an ObjectLoader.' );

		} );

		// PUBLIC
		QUnit.test( 'parse (pivot)', ( assert ) => {

			const object = new Object3D();
			object.position.set( 1, 2, 3 );
			object.rotation.set( 0.3, - 0.7, 1.2 );
			object.scale.set( 2, 3, 4 );
			object.pivot = new Vector3( 1, - 2, 3 );
			object.updateMatrix();

			const loaded = new ObjectLoader().parse( object.toJSON() );

			assert.ok( loaded.pivot.equals( object.pivot ), 'Pivot is restored' );
			assert.ok( loaded.position.distanceTo( object.position ) < eps, 'Position is restored' );

		} );

		QUnit.test( 'parse (Sprite center)', ( assert ) => {

			const sprite = new Sprite();
			sprite.center.set( 0.5, 0 );

			const loaded = new ObjectLoader().parse( sprite.toJSON() );

			assert.ok( loaded.center.equals( sprite.center ), 'Center is restored' );

		} );

		QUnit.test( 'parse (OrthographicCamera zoom projection)', ( assert ) => {

			const camera = new OrthographicCamera( - 1, 1, 1, - 1, 0.1, 100 );
			camera.zoom = 4;
			camera.updateProjectionMatrix();

			const loaded = new ObjectLoader().parse( camera.toJSON() );

			assert.strictEqual( loaded.zoom, 4, 'Zoom property round-trips' );
			assert.ok( Math.abs( loaded.projectionMatrix.elements[ 0 ] - 4 ) < eps, 'Projection uses zoom=4' );
			assert.ok( loaded.projectionMatrix.equals( camera.projectionMatrix ), 'Projection matrix round-trips' );
			assert.ok( loaded.projectionMatrixInverse.equals( camera.projectionMatrixInverse ), 'Inverse matrix round-trips' );

		} );

		QUnit.test( 'parse (PerspectiveCamera zoom projection)', ( assert ) => {

			const camera = new PerspectiveCamera( 90, 1, 1, 100 );
			camera.zoom = 2;
			camera.updateProjectionMatrix();

			const loaded = new ObjectLoader().parse( camera.toJSON() );

			assert.strictEqual( loaded.zoom, 2, 'Zoom property round-trips' );
			assert.ok( Math.abs( loaded.projectionMatrix.elements[ 0 ] - 2 ) < eps, 'Projection uses zoom=2' );
			assert.ok( loaded.projectionMatrix.equals( camera.projectionMatrix ), 'Projection matrix round-trips' );
			assert.ok( loaded.projectionMatrixInverse.equals( camera.projectionMatrixInverse ), 'Inverse matrix round-trips' );

		} );

		QUnit.test( 'parse (PerspectiveCamera view offset projection)', ( assert ) => {

			const camera = new PerspectiveCamera( 90, 2, 1, 100 );
			camera.setViewOffset( 200, 100, 100, 0, 100, 100 );

			const loaded = new ObjectLoader().parse( camera.toJSON() );

			assert.ok( loaded.view.enabled, 'View-offset property round-trips' );
			assert.ok( Math.abs( loaded.projectionMatrix.elements[ 0 ] - 1 ) < eps, 'Projection uses half-width viewport' );
			assert.ok( Math.abs( loaded.projectionMatrix.elements[ 8 ] - 1 ) < eps, 'Projection uses right-half offset' );
			assert.ok( loaded.projectionMatrix.equals( camera.projectionMatrix ), 'Projection matrix round-trips' );
			assert.ok( loaded.projectionMatrixInverse.equals( camera.projectionMatrixInverse ), 'Inverse matrix round-trips' );

		} );

	} );

} );
