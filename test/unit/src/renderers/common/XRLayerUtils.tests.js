import { PlaneGeometry } from '../../../../../src/geometries/PlaneGeometry.js';
import { MeshBasicMaterial } from '../../../../../src/materials/MeshBasicMaterial.js';
import { Mesh } from '../../../../../src/objects/Mesh.js';
import { Vector3 } from '../../../../../src/math/Vector3.js';
import { Quaternion } from '../../../../../src/math/Quaternion.js';
import { createMesh, createPlaneMesh, UVMapFactors, toggleBlendLayerRender, positionQuad } from '../../../../../src/renderers/common/XRLayerUtils.js';

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'Common', () => {

		QUnit.module( 'XRLayerUtils', () => {

			QUnit.test( 'quad transforms use identity defaults and preserve explicit values', ( assert ) => {

				const defaults = createPlaneMesh( null );

				assert.deepEqual( defaults.position.toArray(), [ 0, 0, 0 ], 'default translation is zero' );
				assert.deepEqual( defaults.quaternion.toArray(), [ 0, 0, 0, 1 ], 'default orientation is identity' );

				const moved = createPlaneMesh( null, 0, 2, 2, new Vector3( 3, - 2, 5 ), new Quaternion( 0, 0, 1, 0 ) );

				assert.deepEqual( moved.position.toArray(), [ 3, - 2, 5 ], 'explicit translation is retained' );
				assert.deepEqual( moved.quaternion.toArray(), [ 0, 0, 1, 0 ], 'explicit orientation is retained' );

				const partial = new Mesh( new PlaneGeometry(), new MeshBasicMaterial() );
				positionQuad( partial, { x: - 1, z: 2 }, { z: 1, w: 0 } );

				assert.deepEqual( partial.position.toArray(), [ - 1, 0, 2 ], 'omitted translation components default to zero' );
				assert.deepEqual( partial.quaternion.toArray(), [ 0, 0, 1, 0 ], 'omitted quaternion components default to zero' );

			} );

			QUnit.test( 'stereo top-bottom and left-right UV mapping', ( assert ) => {

				const cases = [
					[ 'stereo-top-bottom', 1, [ 0.25, 0.375 ] ],
					[ 'stereo-top-bottom', 2, [ 0.25, 0.875 ] ],
					[ 'stereo-left-right', 1, [ 0.125, 0.75 ] ],
					[ 'stereo-left-right', 2, [ 0.625, 0.75 ] ]
				];

				for ( const [ layout, eye, expected ] of cases ) {

					const geometry = new PlaneGeometry( 1, 1 );
					geometry.getAttribute( 'uv' ).setXY( 0, 0.25, 0.75 );

					const mesh = createMesh( null, geometry, eye, new MeshBasicMaterial(), UVMapFactors[ layout ] );
					const uv = mesh.geometry.getAttribute( 'uv' );

					assert.deepEqual( [ uv.getX( 0 ), uv.getY( 0 ) ], expected, layout + ' eye ' + eye );

				}

			} );

			QUnit.test( 'blend material toggling is idempotent', ( assert ) => {

				const original = new MeshBasicMaterial();
				const blend = new MeshBasicMaterial();
				const mesh = new Mesh( new PlaneGeometry(), original );
				const layer = { group: { children: [ mesh ] }, blendMaterial: blend };

				toggleBlendLayerRender( layer, false );
				assert.strictEqual( mesh.material, original, 'initial disable leaves the original material intact' );

				toggleBlendLayerRender( layer, true );
				assert.strictEqual( mesh.material, blend, 'first enable applies blend material' );

				toggleBlendLayerRender( layer, true );
				assert.strictEqual( mesh.material, blend, 'repeated enable remains enabled' );

				toggleBlendLayerRender( layer, false );
				assert.strictEqual( mesh.material, original, 'disable restores original material' );

				toggleBlendLayerRender( layer, false );
				assert.strictEqual( mesh.material, original, 'repeated disable preserves original material' );

			} );

		} );

	} );

} );
