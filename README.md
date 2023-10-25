**Update:** The implementation has been updated to Langium v2.0, and with that the branches *expandToString*, *expandToNode*, *expandTracedToNode*, and *main* have been force-pushed. The former commits are still available via the tags *expandToString-Langium-v1*, *expandToNode-Langium-v1*, and *expandTracedToNode-Langium-v1*. (October 25th, 2023)

<div id="langium-logo" align="center">
  <a href="https://github.com/langium/langium">
    <img alt="Langium Logo" width="500" src="https://user-images.githubusercontent.com/4377073/135283991-90ef7724-649d-440a-8720-df13c23bda82.png">
  </a>
  <h3>
    Example application demonstrating a fully-in-browser DSL implementation including Code Generation based on Langium's arithmetics example DSL
  </h3>
</div>

<div id="badges" align="center">

  [![Build](https://github.com/langium/langium-in-browser-codegen-example/actions/workflows/actions.yml/badge.svg)](https://github.com/langium/langium-in-browser-codegen-example/actions/workflows/actions.yml)
  [![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/langium/langium-in-browser-codegen-example/)

</div>

<hr>

This example project demonstrates the usage of Langium in the browser without any backend.
The language server is run in a web worker. It parses and validates the input text on change and — in this special case — sends a serialized snapshot of the abstract syntax tree (AST) to the browser's main thread, provided the text is free of errors. The code generation is than executed in the browser's main thread, and the obtained code is executed subsequently.  
_Remark_: This setup well-suited for the sake of this demostration, but it is not common in production (yet 😁).

## Get started

Run
```
npm i
npm run serve
```
and open http://localhost:3000 in your browser.
Open the browser's developer tools, and put a break point at https://github.com/langium/langium-in-browser-codegen-example/blob/a2e590d9aeccf94178ebed83ab64ad40ebe1c635/src/arithmeticsEditor/index.ts#L44