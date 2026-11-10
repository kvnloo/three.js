import BindGroup from '../../../../../src/renderers/common/BindGroup.js';
import NodeManager from '../../../../../src/renderers/common/nodes/NodeManager.js';
import NodeUniformBuffer from '../../../../../src/renderers/common/nodes/NodeUniformBuffer.js';
import NodeUniformsGroup from '../../../../../src/renderers/common/nodes/NodeUniformsGroup.js';
import BufferNode from '../../../../../src/nodes/accessors/BufferNode.js';
import UniformGroupNode from '../../../../../src/nodes/core/UniformGroupNode.js';
import { NodeUpdateType } from '../../../../../src/nodes/core/constants.js';

export default QUnit.module( 'Renderers', () => {

	QUnit.module( 'Common', () => {

		QUnit.module( 'NodeManager', () => {

			QUnit.test( 'updateGroup: shared uniforms group caches its version', ( assert ) => {

				const groupNode = new UniformGroupNode( 'frame', true, 0, NodeUpdateType.FRAME );
				groupNode.version = 3;

				const group = new NodeUniformsGroup( 'frame', groupNode );
				const manager = new NodeManager( null, null );

				assert.strictEqual( manager.updateGroup( group ), true );
				assert.strictEqual( manager.updateGroup( group ), false );

				groupNode.version = 4;

				assert.strictEqual( manager.updateGroup( group ), true );
				assert.strictEqual( manager.updateGroup( group ), false );

			} );

			QUnit.test( 'updateGroup: cloned shared uniforms group requires an update', ( assert ) => {

				const groupNode = new UniformGroupNode( 'frame', true, 0, NodeUpdateType.FRAME );
				groupNode.version = 3;

				const group = new NodeUniformsGroup( 'frame', groupNode );
				const manager = new NodeManager( null, null );

				assert.strictEqual( manager.updateGroup( group ), true );

				const clone = new BindGroup( 'frame', [ group ] ).clone().bindings[ 0 ];

				assert.notStrictEqual( clone, group );
				assert.strictEqual( clone.groupNode, groupNode );
				assert.strictEqual( clone.groupVersion, - 1 );
				assert.strictEqual( manager.updateGroup( clone ), true );
				assert.strictEqual( manager.updateGroup( clone ), false );

			} );

			QUnit.test( 'updateGroup: cloned shared buffer requires an update', ( assert ) => {

				const groupNode = new UniformGroupNode( 'frame', true, 0, NodeUpdateType.FRAME );
				groupNode.version = 3;

				const node = new BufferNode( new Float32Array( [ 1, 2, 3, 4 ] ), 'vec4', 1 );
				const buffer = new NodeUniformBuffer( node, groupNode );
				const manager = new NodeManager( null, null );

				assert.strictEqual( manager.updateGroup( buffer ), true );
				assert.strictEqual( manager.updateGroup( buffer ), false );

				const clone = new BindGroup( 'frame', [ buffer ] ).clone().bindings[ 0 ];

				assert.notStrictEqual( clone, buffer );
				assert.strictEqual( clone.groupNode, groupNode );
				assert.strictEqual( clone.groupVersion, - 1, 'An updated buffer must not mark its clone as updated' );
				assert.strictEqual( manager.updateGroup( clone ), true, 'A fresh binding must upload in its new bind group' );
				assert.strictEqual( manager.updateGroup( clone ), false );

				groupNode.version = 4;

				assert.strictEqual( manager.updateGroup( clone ), true );

			} );

		} );

	} );

} );
