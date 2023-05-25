/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// We shouldn't import 'SourceMapGenerator' from the 'source-map' package directly
//  as that also loads 'source-map-consumer.js' that transitively refers to node.js builtins.
// That affects bundling: Although transitive depdendencies on node.js builtins can be marked as external,
//  esbuild's tree shaking doesn't drop the 'SourceMapConsumer' and we just don't need it.
//
// Therefore, we just replicated the required type defs of 'SourceMapGenerator' and friends in here. ;-)

declare module 'source-map/lib/source-map-generator.js' {
// original license: BSD-3-Clause
// original header:
    // Type definitions for source-map 0.7
    // Project: https://github.com/mozilla/source-map
    // Definitions by: Morten Houston Ludvigsen <https://github.com/MortenHoustonLudvigsen>,
    //                 Ron Buckton <https://github.com/rbuckton>,
    //                 John Vilk <https://github.com/jvilk>
    // Definitions: https://github.com/mozilla/source-map

    export interface StartOfSourceMap {
        file?: string;
        sourceRoot?: string;
        skipValidation?: boolean;
    }

    export interface Mapping {
        generated: Position;
        original: Position;
        source: string;
        name?: string;
    }

    export interface RawSourceMap {
        version: number;
        sources: string[];
        names: string[];
        sourceRoot?: string;
        sourcesContent?: string[];
        mappings: string;
        file: string;
    }

    export class SourceMapGenerator {
        constructor(startOfSourceMap?: StartOfSourceMap);

        /**
         * Add a single mapping from original source line and column to the generated
         * source's line and column for this source map being created. The mapping
         * object should have the following properties:
         *
         *   - generated: An object with the generated line and column positions.
         *   - original: An object with the original line and column positions.
         *   - source: The original source file (relative to the sourceRoot).
         *   - name: An optional original token name for this mapping.
         */
        addMapping(mapping: Mapping): void;

        /**
         * Set the source content for a source file.
         */
        setSourceContent(sourceFile: string, sourceContent: string): void;

        toString(): string;

        toJSON(): RawSourceMap;
    }
}
