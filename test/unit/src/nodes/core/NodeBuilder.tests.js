import NodeBuilder from '../../../../../src/nodes/core/NodeBuilder.js';
import UniformNode from '../../../../../src/nodes/core/UniformNode.js';
import FunctionNode from '../../../../../src/nodes/code/FunctionNode.js';

class FunctionCacheBuilder extends NodeBuilder {

	constructor( backend, functionBody ) {

		super( null, { backend }, null );

		this.setShaderStage( 'fragment' );
		this.functionBody = functionBody;
		this.functionBuilds = 0;

	}

	buildFunctionCode() {

		this.functionBuilds ++;
		return this.functionBody( this );

	}

}

export default QUnit.module( 'Nodes', () => {

	QUnit.module( 'Core', () => {

		QUnit.module( 'NodeBuilder function cache', () => {

			QUnit.test( 'uniform layout binds to each builder instead of an earlier material', ( assert ) => {

				const backend = {};
				const shaderNode = {};
				const sharedUniform = new UniformNode( 2, 'float' );
				const cases = [
					{ name: 'nodeUniform0', preceding: [], bindings: [ [ 'nodeUniform0', 2 ] ] },
					{ name: 'nodeUniform1', preceding: [ 11 ], bindings: [ [ 'nodeUniform0', 11 ], [ 'nodeUniform1', 2 ] ] },
					{ name: 'nodeUniform2', preceding: [ 11, 13 ], bindings: [ [ 'nodeUniform0', 11 ], [ 'nodeUniform1', 13 ], [ 'nodeUniform2', 2 ] ] }
				];
				let previousFunction = null;

				for ( const row of cases ) {

					const builder = new FunctionCacheBuilder( backend, currentBuilder => sharedUniform.generate( currentBuilder, 'float' ) );

					for ( const value of row.preceding ) {

						new UniformNode( value, 'float' ).generate( builder, 'float' );

					}

					const fn = builder.buildFunctionNode( shaderNode );

					assert.strictEqual( fn.code, row.name, 'function uses the current builder uniform name' );
					assert.deepEqual( builder.uniforms.fragment.map( uniform => [ uniform.name, uniform.value ] ), row.bindings, 'current builder owns the expected uniform values' );
					assert.strictEqual( builder.getDataFromNode( fn ).cachePerMaterial, true, 'uniform-bearing function is material-local' );
					assert.strictEqual( builder.buildFunctionNode( shaderNode ), fn, 'same builder reuses its function' );
					assert.strictEqual( builder.functionBuilds, 1, 'same builder generates function only once' );

					if ( previousFunction !== null ) {

						assert.notStrictEqual( fn, previousFunction, 'different builders do not share uniform-bearing code' );

					}

					previousFunction = fn;

				}

			} );

			QUnit.test( 'nested uniform helper cache hit preserves the enclosing function', ( assert ) => {

				const backend = {};
				const shaderNode = {};
				const sharedUniform = new UniformNode( 3, 'float' );
				const builder = new FunctionCacheBuilder( backend, currentBuilder => sharedUniform.generate( currentBuilder, 'float' ) );

				const helper = builder.buildFunctionNode( shaderNode );
				const outer = new FunctionNode();
				builder.currentFunctionNode = outer;

				assert.strictEqual( builder.buildFunctionNode( shaderNode ), helper, 'inner helper is reused' );
				assert.strictEqual( builder.currentFunctionNode, outer, 'cache hit leaves the active enclosing function unchanged' );
				assert.strictEqual( builder.getDataFromNode( outer ).cachePerMaterial, true, 'outer function inherits its helper uniform dependency' );
				assert.strictEqual( builder.functionBuilds, 1, 'nested reuse does not generate another helper' );

				builder.currentFunctionNode = null;

			} );

			QUnit.test( 'uniform-free layout retains backend-wide function caching', ( assert ) => {

				const backend = {};
				const shaderNode = {};
				const first = new FunctionCacheBuilder( backend, () => '1.0' );
				const second = new FunctionCacheBuilder( backend, () => '2.0' );

				const firstFunction = first.buildFunctionNode( shaderNode );
				const secondFunction = second.buildFunctionNode( shaderNode );

				assert.strictEqual( firstFunction, secondFunction, 'same backend shares uniform-free function' );
				assert.strictEqual( secondFunction.code, '1.0', 'second builder receives original function code' );
				assert.strictEqual( first.functionBuilds, 1, 'first builder generates the function once' );
				assert.strictEqual( second.functionBuilds, 0, 'second builder reuses backend cached code' );

			} );

		} );

	} );

} );
