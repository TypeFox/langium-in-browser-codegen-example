/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultAstNodeLocator, DefaultJsonSerializer, DefaultNameProvider, expandToNode, Generated, joinToNode, toString } from 'langium';
import { Definition, Evaluation, Expression, isBinaryExpression, isDefinition, isFunctionCall, isNumberLiteral, Module, Statement } from 'langium-arithmetics-dsl/api';

export function generate({uri, content}: { uri: string, content: string | Module }): string {
    if (typeof content === 'string') {
        content = deserializeModule(content);
    }

    return toString(
        generateModule(content)
    );
}

function generateModule(root: Module): Generated {
    return expandToNode`
        "use strict";
        (() => {
          ${generateModuleContent(root)}
        })
    `;
}

const lastComputableExpressionValueVarName = 'lastComputableExpressionValue';

function generateModuleContent(module: Module): Generated {
    return expandToNode`
        let ${lastComputableExpressionValueVarName};
        ${ joinToNode(module.statements, generateStatement, { appendNewLineIfNotEmpty: true }) }

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
        expandToNode`
            const ${def.name} = (${joinToNode(def.args, arg => arg.name, { separator: ', '})}) => ${generateExpression(def.expr)};
        ` : expandToNode`
            const ${def.name} = ${lastComputableExpressionValueVarName} = ${generateExpression(def.expr)};
        `;
}

function generateEvaluation(evaln: Evaluation): Generated {
    return expandToNode`
        ${lastComputableExpressionValueVarName} = ${generateExpression(evaln.expression)};
    `;
}

function generateExpression(expr: Expression): Generated {
    if (isNumberLiteral(expr)) {
        return expr.value.toString();

    } else if (isBinaryExpression(expr)) {
        const leftAsIs  = isNumberLiteral(expr.left)  || isFunctionCall(expr.left);
        const rightAsIs = isNumberLiteral(expr.right) || isFunctionCall(expr.right);
        const left  = leftAsIs  ? generateExpression(expr.left)  : expandToNode`(${generateExpression(expr.left )})`;
        const right = rightAsIs ? generateExpression(expr.right) : expandToNode`(${generateExpression(expr.right)})`;
        return expandToNode`
            ${left} ${expr.operator} ${right}
        `;

    } else {
        return expandToNode`${expr.func.ref?.name}`.appendTemplateIf(!!expr.args.length)`
            (
                ${joinToNode(expr.args, generateExpression, { separator: ', ' })}
            )
        `;
    };
}

function deserializeModule(input: string): Module {
    return new DefaultJsonSerializer({
        workspace: {
            AstNodeLocator: new DefaultAstNodeLocator()
        },
        references: {
            NameProvider: new DefaultNameProvider()
        }
    } as any).deserialize(input) as Module;
}