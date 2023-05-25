/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { expandToString } from 'langium';
import { buildWorkerDefinition } from 'monaco-editor-workers';
import { CodeEditorConfig, MonacoEditorLanguageClientWrapper, WorkerConfigOptions } from 'monaco-editor-wrapper';
import { Diagnostic, DiagnosticSeverity, NotificationType } from 'vscode-languageserver/browser.js';
import { generate } from '../generator/generator-with-tracing.js';

type DocumentChange = { uri: string, content: string, diagnostics: Diagnostic[] };

// registers a factory function determining the required bundle
//  and firing up a worker taking over some task of the monaco editor in background
buildWorkerDefinition('.', import.meta.url, true);

// hooks monaco-specific css-definitions into the dom
MonacoEditorLanguageClientWrapper.addMonacoStyles('monaco-editor-styles');

// instantiate the language wrapper collecting the editor settings, ...
const client = new MonacoEditorLanguageClientWrapper('42');

// ... add the required settings, ...
configureEditor((client.getEditorConfig()));

// ... and fire the editor within the given container, ...
client.startEditor(document.getElementById("monaco-editor-root") || undefined);

// ... and register a notification listener expecting the AST in json,
//  generating code, executing that code, and logging the result into the console.
// Such notifications are not sent by Langium by default,
//  it's a customization in the arithmetics example language implementation,
//  see node_modules/langium-arithmetics-dsl/src/language-server/main-browser.ts
client.getLanguageClient()?.onNotification(
    new NotificationType<DocumentChange>('browser/DocumentChange'),
    dc => {
        const errors = dc.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
        if (errors.length !== 0) {
            console.log(`Input contains error in line ${errors[0].range.start.line}: ${errors[0].message}`);

        } else {
            const generated = generate(dc);
            const result = window.eval(generated)();
            console.log("Final computable expression is equal to: " + result);
            const resultDiv = document.getElementById("calculation-result")
            if (resultDiv)
                resultDiv.innerText = result;
        }
    }
);

function configureEditor(editorConfig: CodeEditorConfig) {
    editorConfig.setTheme('vs-dark');
    editorConfig.setAutomaticLayout(true /* 'true' is the default value! */);
    editorConfig.setUseLanguageClient(true);
    editorConfig.setUseWebSocket(false);
    editorConfig.setMainLanguageId('arithmetics');
    editorConfig.setLanguageClientConfigOptions(<WorkerConfigOptions>{
        workerType: 'module',
        workerName: 'LS',
        workerURL: new URL('arithmeticsServerWorker.js', import.meta.url).href
    });

    editorConfig.setMonarchTokensProvider({
        ignoreCase: true,

        keywords: [
            'def', 'module'
        ],

        // The main tokenizer for our languages
        tokenizer: {
            root: [
                // identifiers and keywords
                [/[a-z_$][\w$]*/, {
                    cases: {
                        '@keywords': 'keyword',
                        '@default': 'identifier'
                    }
                }],

                // whitespace
                { include: '@whitespace' }
            ],

            comment: [
                [/[^\/*]+/, 'comment'],
                [/\/\*/, 'comment', '@push'],    // nested comment
                ["\\*/", 'comment', '@pop'],
                [/[\/*]/, 'comment']
            ],

            whitespace: [
                [/[ \t\r\n]+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/\/\/.*$/, 'comment'],
            ]
        }
    });

    editorConfig.setMainCode(expandToString`
        Module priceCalculator

        DEF materialPerUnit:               100;
        DEF laborPerUnit:                  200;
        DEF expectedNoOfSales:             200;
        DEF costPerUnit:                   materialPerUnit + laborPerUnit;

        DEF costOfGoodsSold:               expectedNoOfSales * costPerUnit;
        DEF generalExpensesAndSales:       10000;

        DEF desiredProfitPerUnit:          50;
        DEF netPrice:
            (costOfGoodsSold + generalExpensesAndSales) / expectedNoOfSales + desiredProfitPerUnit;

        DEF vat:                           0.15;

        DEF calcGrossListPrice(net, tax):
            net / (1 - tax);

        calcGrossListPrice(netPrice, vat);
    `);
};