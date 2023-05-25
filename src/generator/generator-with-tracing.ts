/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Base64 } from 'js-base64';
import { AstNodeWithTextRegion, DefaultAstNodeLocator, DefaultJsonSerializer, DefaultNameProvider, expandToNode, expandTracedToNode, Generated, GeneratorNode, joinToNode, joinTracedToNode, NL, toStringAndTrace, traceToNode, TreeStreamImpl } from 'langium';
import { Definition, Evaluation, Expression, isBinaryExpression, isDefinition, isFunctionCall, isNumberLiteral, Module, Statement } from 'langium-arithmetics-dsl/api';
import { SourceMapGenerator, StartOfSourceMap } from 'source-map/lib/source-map-generator.js'; // importing directly from 'source-map' affects bundling, as the 'source-map-consumer' is then also loaded and refers to node.js builtins

export function generate( {uri, content}: { uri: string, content: string | Module }): string {
    const filename = uri.substring(uri.lastIndexOf('/'))

    if (typeof content === 'string') {
        content = deserializeModule(content);
    }

    let { text, trace } = toStringAndTrace(
        generateModule(content)
    );

    const mapper: SourceMapGenerator = new SourceMapGenerator(<StartOfSourceMap>{ file: filename + '.js' });
    const sourceDefinitionText = (content as AstNodeWithTextRegion).$sourceText ?? '';
    mapper.setSourceContent(filename, sourceDefinitionText/*.replace(/DEF/ig, 'var')*/ ?? '<Source text not available>');

    new TreeStreamImpl(trace, r => r.children ?? [], { includeRoot: true }).forEach(r => {
        if (!r.sourceRegion
            || !r.targetRegion
            || r.children?.[0].targetRegion.offset === r.targetRegion.offset /* if the first child starts at the same position like this (potentially encompassing) region, skip this on and continue with the child(ren) */
        ) {
            return;
        }

        const sourceStart = r.sourceRegion.range?.start;
        const targetStart = r.targetRegion.range?.start;

        const sourceEnd = r.sourceRegion?.range?.end;
        const sourceText = sourceEnd && sourceDefinitionText.length >= r.sourceRegion.end
            ? sourceDefinitionText.substring(r.sourceRegion.offset, r.sourceRegion.end) : ''

        sourceStart && targetStart && mapper.addMapping({
            original:  { line: sourceStart.line + 1, column: sourceStart.character },
            generated: { line: targetStart.line + 1, column: targetStart.character },
            source: filename,
            name: /^[A-Za-z_]$/.test(sourceText) ? sourceText.toLowerCase() : undefined
        });

        // const sourceEnd = r.sourceRegion?.range?.end;
        // const sourceText = sourceEnd && sourceDefinitionText.length >= r.sourceRegion.end
        //     ? sourceDefinitionText.substring(r.sourceRegion.offset, r.sourceRegion.end) : ''
        const targetEnd = r.targetRegion?.range?.end;
        const targetText = targetEnd && text.length >= r.targetRegion.end
            ? text.substring(r.targetRegion.offset, r.targetRegion.end) : ''

        sourceEnd && targetEnd && !r.children && sourceText && targetText
                && !/\s/.test(sourceText) && !/\s/.test(targetText)
                && mapper.addMapping({
            original:  { line: sourceEnd.line + 1, column: sourceEnd.character },
            generated: { line: targetEnd.line + 1, column: targetEnd.character},
            source: filename
        });
    });

    const sourceMap = mapper.toString();
    if (sourceMap) {
        text += `\n\n//# sourceMappingURL=data:application/json;charset=urf-8;base64,${Base64.encode(sourceMap)}`;
    }
    return text;
}

function generateModule(root: Module): GeneratorNode {
    return expandToNode`
        "use strict";
        (() => {
            ${generateModuleContent(root)}
        })
    `;
}

const lastComputableExpressionValueVarName = 'lastComputableExpressionValue';

function generateModuleContent(module: Module): Generated {
    return expandTracedToNode(module)`
        let ${lastComputableExpressionValueVarName};
        ${ joinTracedToNode(module, 'statements')(module.statements, generateStatement, { appendNewLineIfNotEmpty: true }) }

        return ${lastComputableExpressionValueVarName};
    `;
}

function generateStatement(stmt: Statement): Generated {
    if (isDefinition(stmt))
        return generateDefinition(stmt);
    else
        return generateEvaluation(stmt);
}

function generateDefinition(def: Definition): Generated {
    return def.args && def.args.length ?
        expandTracedToNode(def)`
            const ${traceToNode(def, 'name')(def.name)} = (${joinTracedToNode(def, 'args')(def.args, arg => traceToNode(arg)(arg.name), { separator: ', '})}) => ${generateExpression(def.expr)};
        ` : expandTracedToNode(def)`
            ${traceToNode(def)('const')} ${traceToNode(def, 'name')(def.name)} = ${lastComputableExpressionValueVarName} = ${generateExpression(def.expr)};
        `;
}

function generateEvaluation(evaln: Evaluation): Generated {
    return expandTracedToNode(evaln)`
        ${lastComputableExpressionValueVarName} = ${generateExpression(evaln.expression)};
    `;
}

function generateExpression(expr: Expression): Generated {

    if (isNumberLiteral(expr)) {
        return traceToNode(expr, 'value')( expr.value.toString() );

    } else if (isBinaryExpression(expr)) {
        const leftAsIs  = isNumberLiteral(expr.left)  || isFunctionCall(expr.left);
        const rightAsIs = isNumberLiteral(expr.right) || isFunctionCall(expr.right);
        const left  = leftAsIs  ? generateExpression(expr.left)  : expandTracedToNode(expr, "left" )`(${generateExpression(expr.left )})`;
        const right = rightAsIs ? generateExpression(expr.right) : expandTracedToNode(expr, "right")`(${generateExpression(expr.right)})`;
        return expandTracedToNode(expr)`
            ${left} ${traceToNode(expr, 'operator')(expr.operator)} ${right}
        `;

    } else {
        return traceToNode(expr)(
            parent => parent
                .appendTraced(expr, 'func')(expr.func.ref?.name)
                .appendTracedTemplateIf(!!expr.args.length, expr, 'args')`
                    (
                        ${joinToNode(expr.args, generateExpression, { separator: ', ' })}
                    )
                `
        );
    };
}

function deserializeModule(input: string): Module {
    return new DefaultJsonSerializer({
        workspace: {
            AstNodeLocator: new DefaultAstNodeLocator()
        },
        references: {
            NameProvider: new DefaultNameProvider()
        },
        documentation: {
            CommentProvider: undefined
        }
    } as any).deserialize(input) as Module;
}