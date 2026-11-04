import { GLTFLoader } from '../../../../examples/jsm/loaders/GLTFLoader.js';
import { GLTFGaussianSplatLoaderExtension } from '../../../../examples/jsm/loaders/GLTFGaussianSplatLoaderExtension.js';
import { makeClipAdditive } from '../../../../src/animation/AnimationUtils.js';
import { unpackSphericalHarmonicsBand } from '../utils/GaussianSplatTestUtils.js';

const EPS = 1e-6;
const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;

function closeTo( assert, actual, expected, message ) {

	assert.ok( Math.abs( actual - expected ) < EPS, `${ message }: ${ actual } ~= ${ expected }` );

}

function arrayBufferToBase64( buffer ) {

	let binary = '';
	const bytes = new Uint8Array( buffer );

	for ( let i = 0; i < bytes.length; i ++ ) {

		binary += String.fromCharCode( bytes[ i ] );

	}

	return btoa( binary );

}

function createGaussianSplatGLTF( { sphericalHarmonicsDegree = 0 } = {} ) {

	const chunks = [];
	const bufferViews = [];
	const accessors = [];
	const attributes = {};
	let byteOffset = 0;

	function addAccessor( array, type, componentType, normalized = false, min = undefined, max = undefined ) {

		while ( byteOffset % 4 !== 0 ) {

			chunks.push( new Uint8Array( [ 0 ] ) );
			byteOffset ++;

		}

		const bytes = new Uint8Array( array.buffer, array.byteOffset, array.byteLength );
		const bufferView = bufferViews.push( {
			buffer: 0,
			byteOffset,
			byteLength: bytes.byteLength
		} ) - 1;
		const accessor = {
			bufferView,
			componentType,
			count: 1,
			type
		};

		if ( normalized === true ) accessor.normalized = true;
		if ( min !== undefined ) accessor.min = min;
		if ( max !== undefined ) accessor.max = max;

		chunks.push( bytes );
		byteOffset += bytes.byteLength;

		return accessors.push( accessor ) - 1;

	}

	const position = addAccessor( new Float32Array( [ 1, 2, 3 ] ), 'VEC3', FLOAT, false, [ 1, 2, 3 ], [ 1, 2, 3 ] );
	const scale = addAccessor( new Float32Array( [ 2, 3, 4 ] ), 'VEC3', FLOAT );
	const rotation = addAccessor( new Int8Array( [ 0, 0, 0, 127 ] ), 'VEC4', 5120, true );
	const opacity = addAccessor( new Uint8Array( [ 128 ] ), 'SCALAR', UNSIGNED_BYTE, true );
	const sh0 = addAccessor( new Float32Array( [ 0, 0, 0 ] ), 'VEC3', FLOAT );

	attributes.POSITION = position;
	attributes[ 'KHR_gaussian_splatting:SCALE' ] = scale;
	attributes[ 'KHR_gaussian_splatting:ROTATION' ] = rotation;
	attributes[ 'KHR_gaussian_splatting:OPACITY' ] = opacity;
	attributes[ 'KHR_gaussian_splatting:SH_DEGREE_0_COEF_0' ] = sh0;

	for ( let degree = 1; degree <= sphericalHarmonicsDegree; degree ++ ) {

		const coefficientCount = degree * 2 + 1;

		for ( let coefficient = 0; coefficient < coefficientCount; coefficient ++ ) {

			attributes[ `KHR_gaussian_splatting:SH_DEGREE_${ degree }_COEF_${ coefficient }` ] = addAccessor(
				new Float32Array( [ ( coefficient + 1 ) / 128, ( coefficient + 2 ) / 128, ( coefficient + 3 ) / 128 ] ),
				'VEC3',
				FLOAT
			);

		}

	}

	const buffer = new Uint8Array( byteOffset );
	let offset = 0;

	for ( const chunk of chunks ) {

		buffer.set( chunk, offset );
		offset += chunk.byteLength;

	}

	return {
		asset: { version: '2.0' },
		scene: 0,
		scenes: [ { nodes: [ 0 ] } ],
		nodes: [ { mesh: 0 } ],
		meshes: [ {
			primitives: [ {
				mode: 0,
				attributes,
				extensions: {
					KHR_gaussian_splatting: {
						kernel: 'ellipse',
						colorSpace: 'srgb_rec709_display'
					}
				}
			} ]
		} ],
		accessors,
		bufferViews,
		buffers: [ {
			byteLength: buffer.byteLength,
			uri: 'data:application/octet-stream;base64,' + arrayBufferToBase64( buffer.buffer )
		} ],
		extensionsUsed: [ 'KHR_gaussian_splatting' ]
	};

}

function createSceneMappingGLTF( meshes, nodes ) {

	const positions = new Float32Array( [
		0, 0, 0,
		1, 0, 0,
		0, 1, 0
	] );

	return {
		asset: { version: '2.0' },
		scene: 0,
		scenes: [ { nodes: Array.from( nodes.keys() ) } ],
		nodes,
		meshes,
		buffers: [ {
			byteLength: positions.byteLength,
			uri: 'data:application/octet-stream;base64,' + arrayBufferToBase64( positions.buffer )
		} ],
		bufferViews: [ { buffer: 0, byteLength: positions.byteLength } ],
		accessors: [ {
			bufferView: 0,
			componentType: FLOAT,
			count: 3,
			type: 'VEC3',
			min: [ 0, 0, 0 ],
			max: [ 1, 1, 0 ]
		} ]
	};

}

export default QUnit.module( 'Addons', () => {

	QUnit.module( 'Loaders', () => {

		QUnit.module( 'GLTFLoader', () => {

			QUnit.test( 'child credentials', async ( assert ) => {

				const loader = new GLTFLoader().setWithCredentials( true );
				const { parser } = await loader.parseAsync( { asset: { version: '2.0' } }, '' );
				assert.strictEqual( parser.fileLoader.withCredentials, true );
				assert.strictEqual( parser.textureLoader.withCredentials, true );

			} );

			QUnit.test( 'keeps primitive extras distinct in cached geometries', async ( assert ) => {

				const positions = new Float32Array( [
					0, 0, 0,
					1, 0, 0,
					0, 1, 0
				] );
				const extrasA = { label: 'PrimA', meta: { index: 1 } };
				const extrasB = { label: 'PrimB', meta: { index: 2 } };
				const json = {
					asset: { version: '2.0' },
					scene: 0,
					scenes: [ { nodes: [ 0, 1, 2, 3 ] } ],
					nodes: [ { mesh: 0 }, { mesh: 1 }, { mesh: 2 }, { mesh: 3 } ],
					meshes: [
						{ primitives: [ { attributes: { POSITION: 0 }, extras: extrasA } ] },
						{ primitives: [ { attributes: { POSITION: 0 }, extras: extrasB } ] },
						{ primitives: [ { attributes: { POSITION: 0 }, extras: { label: 'PrimA', meta: { index: 1 } } } ] },
						{ primitives: [ { attributes: { POSITION: 0 } } ] }
					],
					buffers: [ {
						byteLength: positions.byteLength,
						uri: 'data:application/octet-stream;base64,' + arrayBufferToBase64( positions.buffer )
					} ],
					bufferViews: [ { buffer: 0, byteLength: positions.byteLength } ],
					accessors: [ {
						bufferView: 0,
						componentType: FLOAT,
						count: 3,
						type: 'VEC3',
						min: [ 0, 0, 0 ],
						max: [ 1, 1, 0 ]
					} ]
				};
				const gltf = await new GLTFLoader().parseAsync( JSON.stringify( json ), '' );
				const meshes = gltf.scene.children.map( node => node.children[ 0 ].children[ 0 ] );
				const [ meshA, meshB, meshASame, meshWithoutExtras ] = meshes;

				assert.deepEqual( meshA.geometry.userData, extrasA, 'first primitive keeps its extras' );
				assert.deepEqual( meshB.geometry.userData, extrasB, 'second primitive keeps different extras' );
				assert.deepEqual( meshASame.geometry.userData, extrasA, 'equal extras remain intact' );
				assert.deepEqual( meshWithoutExtras.geometry.userData, {}, 'primitive without extras stays empty' );
				assert.notStrictEqual( meshA.geometry, meshB.geometry, 'different extras use different geometries' );
				assert.strictEqual( meshA.geometry, meshASame.geometry, 'equal extras still share the cached geometry' );
				assert.notStrictEqual( meshA.geometry, meshWithoutExtras.geometry, 'missing extras use a separate geometry' );
				assert.strictEqual( new Set( meshes.map( mesh => mesh.geometry ) ).size, 3, 'four primitives produce three geometries' );

			} );


			QUnit.test( 'keeps named glTF nodes, mesh groups, and primitives distinct', async ( assert ) => {

				const json = createSceneMappingGLTF( [
					{
						name: 'NamedMesh',
						extras: { level: 'named-mesh' },
						primitives: [ { attributes: { POSITION: 0 }, extras: { level: 'named-primitive' } } ]
					},
					{
						extras: { level: 'unnamed-mesh' },
						primitives: [ { attributes: { POSITION: 0 }, extras: { level: 'unnamed-primitive' } } ]
					}
				], [
					{ name: 'NamedNode', mesh: 0, extras: { level: 'named-node' } },
					{ name: 'UnnamedMeshNode', mesh: 1, extras: { level: 'unnamed-node' } }
				] );
				const gltf = await new GLTFLoader().parseAsync( JSON.stringify( json ), '' );
				const [ namedNode, unnamedNode ] = gltf.scene.children;
				const namedGroup = namedNode.children[ 0 ];
				const unnamedGroup = unnamedNode.children[ 0 ];
				const namedPrimitive = namedGroup.children[ 0 ];
				const unnamedPrimitive = unnamedGroup.children[ 0 ];

				assert.strictEqual( namedNode.type, 'Object3D', 'named glTF node has its own Object3D' );
				assert.strictEqual( unnamedNode.type, 'Object3D', 'unnamed mesh does not flatten its glTF node' );
				assert.strictEqual( namedNode.name, 'NamedNode', 'node keeps its name' );
				assert.strictEqual( unnamedNode.name, 'UnnamedMeshNode', 'node remains named without a mesh name' );
				assert.deepEqual( namedNode.userData, { name: 'NamedNode', level: 'named-node' }, 'node extras stay on the node' );
				assert.deepEqual( unnamedNode.userData, { name: 'UnnamedMeshNode', level: 'unnamed-node' }, 'second node extras stay separate' );
				assert.strictEqual( namedGroup.type, 'Group', 'single-primitive named mesh has a Group' );
				assert.strictEqual( unnamedGroup.type, 'Group', 'single-primitive unnamed mesh has a Group' );
				assert.strictEqual( namedGroup.name, 'NamedMesh', 'glTF mesh name is preserved' );
				assert.strictEqual( unnamedGroup.name, 'mesh_1', 'missing mesh name uses its index' );
				assert.deepEqual( namedGroup.userData, { level: 'named-mesh' }, 'named mesh extras stay on its Group' );
				assert.deepEqual( unnamedGroup.userData, { level: 'unnamed-mesh' }, 'unnamed mesh extras stay on its Group' );
				assert.strictEqual( namedGroup.children.length, 1, 'named mesh has one primitive child' );
				assert.strictEqual( unnamedGroup.children.length, 1, 'unnamed mesh has one primitive child' );
				assert.strictEqual( namedPrimitive.type, 'Mesh', 'named mesh primitive is a Mesh' );
				assert.strictEqual( unnamedPrimitive.type, 'Mesh', 'unnamed mesh primitive is a Mesh' );
				assert.strictEqual( namedPrimitive.name, 'NamedMesh_primitive_0', 'primitive has its own name' );
				assert.strictEqual( unnamedPrimitive.name, 'mesh_1_primitive_0', 'unnamed primitive gets a stable fallback name' );
				assert.deepEqual( namedPrimitive.userData, {}, 'mesh extras do not leak into named primitive userData' );
				assert.deepEqual( unnamedPrimitive.userData, {}, 'mesh extras do not leak into unnamed primitive userData' );
				assert.deepEqual( namedPrimitive.geometry.userData, { level: 'named-primitive' }, 'primitive extras retain the geometry contract from PR #11' );
				assert.deepEqual( unnamedPrimitive.geometry.userData, { level: 'unnamed-primitive' }, 'unnamed primitive extras retain the geometry contract' );
				assert.strictEqual( namedGroup.parent, namedNode, 'mesh Group belongs to its node' );
				assert.strictEqual( namedPrimitive.parent, namedGroup, 'primitive Mesh belongs to its mesh Group' );
				assert.deepEqual( gltf.parser.associations.get( namedGroup ), { meshes: 0 }, 'group maps to glTF mesh index' );
				assert.deepEqual( gltf.parser.associations.get( namedPrimitive ), { meshes: 0, primitives: 0 }, 'primitive maps to glTF primitive index' );

			} );

			QUnit.test( 'keeps unnamed multi-primitive mesh identities across nodes', async ( assert ) => {

				const json = createSceneMappingGLTF( [ {
					extras: { role: 'mesh' },
					primitives: [
						{ attributes: { POSITION: 0 }, extras: { role: 'primitive-A' } },
						{ attributes: { POSITION: 0 }, extras: { role: 'primitive-B' } }
					]
				} ], [
					{ name: 'MultiNodeA', mesh: 0, extras: { role: 'node-A' } },
					{ name: 'MultiNodeB', mesh: 0, extras: { role: 'node-B' } }
				] );
				const gltf = await new GLTFLoader().parseAsync( JSON.stringify( json ), '' );
				const [ nodeA, nodeB ] = gltf.scene.children;
				const groupA = nodeA.children[ 0 ];
				const groupB = nodeB.children[ 0 ];
				const [ meshA0, meshA1 ] = groupA.children;
				const [ meshB0, meshB1 ] = groupB.children;

				assert.notStrictEqual( nodeA, nodeB, 'distinct glTF nodes remain distinct' );
				assert.strictEqual( nodeA.type, 'Object3D', 'first glTF node remains an Object3D' );
				assert.strictEqual( nodeB.type, 'Object3D', 'second glTF node remains an Object3D' );
				assert.deepEqual( nodeA.userData, { name: 'MultiNodeA', role: 'node-A' }, 'first node metadata stays on node' );
				assert.deepEqual( nodeB.userData, { name: 'MultiNodeB', role: 'node-B' }, 'second node metadata stays on node' );
				assert.strictEqual( groupA.type, 'Group', 'first mesh is represented by Group' );
				assert.strictEqual( groupB.type, 'Group', 'second mesh is represented by Group' );
				assert.ok( groupA.name.startsWith( 'mesh_0' ), 'unnamed mesh uses index-derived name' );
				assert.ok( groupB.name.startsWith( 'mesh_0' ), 'instanced unnamed mesh keeps index-derived name' );
				assert.notStrictEqual( groupA, groupB, 'separate nodes have separate mesh Groups' );
				assert.notStrictEqual( groupA.name, groupB.name, 'cloned mesh Groups have distinct names' );
				assert.deepEqual( groupA.userData, { role: 'mesh' }, 'first group preserves mesh extras' );
				assert.deepEqual( groupB.userData, { role: 'mesh' }, 'second group preserves mesh extras' );
				assert.strictEqual( groupA.children.length, 2, 'first mesh has two primitive Mesh children' );
				assert.strictEqual( groupB.children.length, 2, 'second mesh has two primitive Mesh children' );
				assert.strictEqual( meshA0.type, 'Mesh', 'primitive 0 is a Mesh' );
				assert.strictEqual( meshA1.type, 'Mesh', 'primitive 1 is a Mesh' );
				assert.notStrictEqual( meshA0, meshA1, 'distinct primitives remain distinct Mesh objects' );
				assert.notStrictEqual( meshA0, meshB0, 'nodes do not reuse a primitive Mesh instance' );
				assert.deepEqual( meshA0.userData, {}, 'mesh metadata does not leak into primitive 0' );
				assert.deepEqual( meshA1.userData, {}, 'mesh metadata does not leak into primitive 1' );
				assert.deepEqual( meshA0.geometry.userData, { role: 'primitive-A' }, 'primitive A extras retained on its geometry' );
				assert.deepEqual( meshA1.geometry.userData, { role: 'primitive-B' }, 'primitive B extras retained on its geometry' );
				assert.notStrictEqual( meshA0.geometry, meshA1.geometry, 'different extras separate cached geometries' );
				assert.strictEqual( meshA0.geometry, meshB0.geometry, 'equivalent primitive A shares its cached geometry across nodes' );
				assert.strictEqual( meshA1.geometry, meshB1.geometry, 'equivalent primitive B shares its cached geometry across nodes' );
				assert.strictEqual( new Set( [ meshA0, meshA1, meshB0, meshB1 ].map( mesh => mesh.geometry ) ).size, 2, 'four primitive Mesh objects share two geometries' );

			} );

			QUnit.test( 'CUBICSPLINE animations can be made additive at an interpolated frame', async ( assert ) => {

				const buffer = new Float32Array( [
					0, 1,
					0, 0, 0, 1, 2, 3, 0, 0, 0,
					0, 0, 0, 3, 4, 5, 0, 0, 0
				] );
				const json = {
					asset: { version: '2.0' },
					scene: 0,
					scenes: [ { nodes: [ 0 ] } ],
					nodes: [ {} ],
					buffers: [ { byteLength: buffer.byteLength, uri: 'data:application/octet-stream;base64,' + arrayBufferToBase64( buffer.buffer ) } ],
					bufferViews: [ { buffer: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 72 } ],
					accessors: [
						{ bufferView: 0, componentType: FLOAT, count: 2, type: 'SCALAR', min: [ 0 ], max: [ 1 ] },
						{ bufferView: 1, componentType: FLOAT, count: 6, type: 'VEC3' }
					],
					animations: [ {
						samplers: [ { input: 0, output: 1, interpolation: 'CUBICSPLINE' } ],
						channels: [ { sampler: 0, target: { node: 0, path: 'translation' } } ]
					} ]
				};
				const gltf = await new GLTFLoader().parseAsync( JSON.stringify( json ), '' );
				const clip = gltf.animations[ 0 ];

				makeClipAdditive( clip, 15, clip, 30 );

				assert.deepEqual( Array.from( clip.tracks[ 0 ].values ), [
					0, 0, 0, - 1, - 1, - 1, 0, 0, 0,
					0, 0, 0, 1, 1, 1, 0, 0, 0
				], 'Subtracts the interpolated reference value and preserves tangents' );

			} );

			QUnit.test( 'loads KHR_gaussian_splatting primitives as GaussianSplat', async ( assert ) => {

				const loader = new GLTFLoader();
				loader.register( function ( parser ) {

					return new GLTFGaussianSplatLoaderExtension( parser );

				} );

				const gltf = await loader.parseAsync( JSON.stringify( createGaussianSplatGLTF() ), '' );
				const mesh = gltf.scene.children[ 0 ];
				const covariances = mesh.splatGeometry.getAttribute( 'covariance' ).array;

				assert.ok( mesh.isGaussianSplat, 'creates GaussianSplat' );
				assert.deepEqual( Array.from( mesh.splatGeometry.getAttribute( 'position' ).array ), [ 1, 2, 3 ], 'loads centers' );
				closeTo( assert, covariances[ 0 ], 4, 'covariance xx' );
				closeTo( assert, covariances[ 3 ], 9, 'covariance yy' );
				closeTo( assert, covariances[ 5 ], 16, 'covariance zz' );
				assert.deepEqual( Array.from( mesh.splatGeometry.getAttribute( 'color' ).array ), [ 128, 128, 128, 128 ], 'loads degree-0 color and opacity' );

			} );

			QUnit.test( 'loads KHR_gaussian_splatting spherical harmonics attributes', async ( assert ) => {

				const loader = new GLTFLoader();
				loader.register( function ( parser ) {

					return new GLTFGaussianSplatLoaderExtension( parser );

				} );

				const gltf = await loader.parseAsync( JSON.stringify( createGaussianSplatGLTF( { sphericalHarmonicsDegree: 1 } ) ), '' );
				const mesh = gltf.scene.children[ 0 ];

				assert.deepEqual( Array.from( unpackSphericalHarmonicsBand( mesh.splatGeometry.getAttribute( 'sphericalHarmonics1' ).array, 1, 1 ) ), [
					129, 130, 131,
					130, 131, 132,
					131, 132, 133
				], 'loads SH1 coefficients' );

			} );

		} );

	} );

} );
