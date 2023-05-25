/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************
 */

import { DefaultAstNodeLocator, DefaultJsonSerializer, DefaultNameProvider, expandToString } from 'langium';
import { Definition, Evaluation, Expression, isBinaryExpression, isDefinition, isFunctionCall, isNumberLiteral, Module, Statement } from 'langium-arithmetics-dsl/api';

export function generate({uri, content}: { uri: string, content: string | Module }): string {
    if (typeof content === 'string') {
        content = deserializeModule(content);
    }

    return generateModule(content);
}

function generateModule(root: Module): string {
    return expandToString`
        "use strict";
        (() => {
          ${generateModuleContent(root)}
        })
    `;
}

const lastComputableExpressionValueVarName = 'lastComputableExpressionValue';

function generateModuleContent(module: Module): string {
    return expandToString`
        let ${lastComputableExpressionValueVarName};
        ${ module.statements.map(generateStatement).join('\n') }

        return ${lastComputableExpressionValueVarName};
    `;
}

function generateStatement(stmt: Statement): string {
    if (isDefinition(stmt))
        return generateDefinition(stmt);
    else
        return generateEvaluation(stmt);
}

function generateDefinition(def: Definition): string {
    return def.args && def.args.length ?
        expandToString`
            const ${def.name} = (${ def.args.map(arg => arg.name).join(', ') }) => ${generateExpression(def.expr)};
        ` : expandToString`
            const ${def.name} = ${lastComputableExpressionValueVarName} = ${generateExpression(def.expr)};
        `
    ;
}

function generateEvaluation(evaln: Evaluation): string {
    return `${lastComputableExpressionValueVarName} = ${generateExpression(evaln.expression)};`;
}

function generateExpression(expr: Expression): string {
    if (isNumberLiteral(expr)) {
        return expr.value.toString();

    } else if (isBinaryExpression(expr)) {
        const leftAsIs  = isNumberLiteral(expr.left)  || isFunctionCall(expr.left);
        const rightAsIs = isNumberLiteral(expr.right) || isFunctionCall(expr.right);
        const left  = leftAsIs  ? generateExpression(expr.left)  : `(${generateExpression(expr.left )})`;
        const right = rightAsIs ? generateExpression(expr.right) : `(${generateExpression(expr.right)})`;
        return expandToString`
            ${left} ${expr.operator} ${right}
        `;

    } else {
        return !expr.args?.length ? expr.func.ref!.name : expandToString`
            ${expr.func.ref!.name}(
                ${expr.args.map(generateExpression).join(', ') }
            )
        `
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