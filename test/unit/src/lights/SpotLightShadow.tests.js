import { SpotLightShadow } from '../../../../src/lights/SpotLightShadow.js';

import { LightShadow } from '../../../../src/lights/LightShadow.js';
import { SpotLight } from '../../../../src/lights/SpotLight.js';
import { ObjectLoader } from '../../../../src/loaders/ObjectLoader.js';

export default QUnit.module( 'Lights', () => {

	QUnit.module( 'SpotLightShadow', () => {

		// INHERITANCE
		QUnit.test( 'Extending', ( assert ) => {

			const object = new SpotLightShadow();
			assert.strictEqual(
				object instanceof LightShadow, true,
				'SpotLightShadow extends from LightShadow'
			);

		} );

		// INSTANCING
		QUnit.test( 'Instancing', ( assert ) => {

			const object = new SpotLightShadow();
			assert.ok( object, 'Can instantiate a SpotLightShadow.' );

		} );

		// PUBLIC
		QUnit.test( 'isSpotLightShadow', ( assert ) => {

			const object = new SpotLightShadow();
			assert.ok(
				object.isSpotLightShadow,
				'SpotLightShadow.isSpotLightShadow should be true'
			);

		} );

		// OTHERS
		QUnit.test( 'updateMatrices (distance limit)', ( assert ) => {

			const light = new SpotLight();
			const shadow = light.shadow;

			light.updateMatrixWorld();
			light.target.updateMatrixWorld();

			light.distance = 10;
			shadow.updateMatrices( light );
			assert.strictEqual( shadow.camera.far, 10, 'finite distance sets the camera far plane' );

			light.distance = 0;
			shadow.updateMatrices( light );
			assert.strictEqual( shadow.camera.far, 500, 'unlimited range restores the default limit' );

			shadow.shadowLimit = 300;
			shadow.updateMatrices( light );
			assert.strictEqual( shadow.camera.far, 300, 'custom limit applies to unlimited range' );

			light.distance = 20;
			shadow.updateMatrices( light );
			assert.strictEqual( shadow.camera.far, 20, 'finite distance overrides the custom limit' );

			light.distance = 0;
			shadow.updateMatrices( light );
			assert.strictEqual( shadow.camera.far, 300, 'custom limit survives finite distance' );

		} );

		QUnit.test( 'clone/copy', ( assert ) => {

			const a = new SpotLightShadow();
			const b = new SpotLightShadow();

			assert.notDeepEqual( a, b, 'Newly instanced shadows are not equal' );

			a.shadowLimit = 750;

			const c = a.clone();
			assert.strictEqual( c.shadowLimit, 750, 'clone preserves shadowLimit' );
			assert.smartEqual( a, c, 'Shadows are identical after clone()' );

			c.mapSize.set( 256, 256 );
			assert.notDeepEqual( a, c, 'Shadows are different again after change' );

			b.copy( a );
			assert.strictEqual( b.shadowLimit, 750, 'copy preserves shadowLimit' );
			assert.smartEqual( a, b, 'Shadows are identical after copy()' );

			b.mapSize.set( 512, 512 );
			assert.notDeepEqual( a, b, 'Shadows are different again after change' );

		} );

		QUnit.test( 'toJSON', ( assert ) => {

			const light = new SpotLight();
			const shadow = new SpotLightShadow();

			shadow.bias = 10;
			shadow.radius = 5;
			shadow.shadowLimit = 750;
			shadow.mapSize.set( 128, 128 );
			light.shadow = shadow;

			const json = light.toJSON();
			const newLight = new ObjectLoader().parse( json );

			assert.strictEqual( json.object.shadow.shadowLimit, 750, 'shadow limit is serialized' );
			assert.strictEqual( newLight.shadow.shadowLimit, 750, 'shadow limit is parsed' );
			assert.smartEqual( newLight.shadow, light.shadow, 'Reloaded shadow is equal to the original one' );

		} );

	} );

} );
