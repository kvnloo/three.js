import { error } from '../../utils.js';
import StackTrace from '../core/StackTrace.js';
import PropertyNode from './PropertyNode.js';
import { shaderStages } from './constants.js';

/**
 * Special version of {@link PropertyNode} which is used for parameters.
 *
 * @augments PropertyNode
 */
class ParameterNode extends PropertyNode {

	static get type() {

		return 'ParameterNode';

	}

	/**
	 * Constructs a new parameter node.
	 *
	 * @param {string} nodeType - The type of the node.
	 * @param {?string} [name=null] - The name of the parameter in the shader.
	 */
	constructor( nodeType, name = null ) {

		super( nodeType, name );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isParameterNode = true;

	}

	/**
	 * Gets the type of a member variable in the parameter node.
	 *
	 * @param {NodeBuilder} builder - The node builder.
	 * @param {string} name - The name of the member variable.
	 * @returns {string}
	 */
	getMemberType( builder, name ) {

		const type = this.getNodeType( builder );
		let struct = builder.getStructTypeNode( type );

		// A struct can be registered in a different shader stage first.
		if ( struct === null ) {

			for ( const shaderStage of shaderStages ) {

				const knownStruct = builder.getStructTypeNode( type, shaderStage );

				if ( knownStruct !== null ) {

					builder.getStructTypeFromNode( knownStruct, knownStruct.membersLayout, type );
					struct = knownStruct;
					break;

				}

			}

		}

		let memberType;

		if ( struct !== null ) {

			memberType = struct.getMemberType( builder, name );

		} else {

			error( `TSL: Member "${ name }" not found in struct "${ type }".`, new StackTrace() );

			memberType = 'float';

		}

		return memberType;

	}

	getHash() {

		return String( this.id );

	}

	generate() {

		return this.name;

	}

}

export default ParameterNode;

/**
 * TSL function for creating a parameter node.
 *
 * @tsl
 * @function
 * @param {string} type - The type of the node.
 * @param {?string} name - The name of the parameter in the shader.
 * @returns {ParameterNode}
 */
export const parameter = ( type, name ) => new ParameterNode( type, name );
