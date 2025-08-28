# Tree-sitter Summary

## Overview
Tree-sitter is a parser generator tool and incremental parsing library that builds concrete syntax trees for source files and efficiently updates them as files are edited.

## Key Features
- **General**: Can parse any programming language
- **Fast**: Parses on every keystroke in text editors
- **Robust**: Provides useful results even with syntax errors
- **Dependency-free**: Runtime library written in pure C11, embeddable in any application

## Language Bindings

### Official Bindings
- C#, Go, Haskell, Java (JDK 22+), JavaScript (Node.js/Wasm), Kotlin, Python, Rust, Swift, Zig

### Third-party Bindings
- C++ (.NET), Crystal, D, Delphi, ELisp, Guile, Janet, Java (JDK 8+/11+), Julia, Lua, OCaml, Odin, Perl, Pharo, PHP, R, Ruby

## Available Parsers
The upstream organization provides parsers for:
- Agda, Bash, C, C++, C#, CSS, ERB/EJS, Go, Haskell, HTML, Java, JavaScript, JSDoc, JSON, Julia, OCaml, PHP, Python, Regex, Ruby, Rust, Scala, TypeScript, Verilog

## Research Foundation
Tree-sitter's design is influenced by research on:
- Incremental software development environments
- Context-aware scanning for extensible languages
- Efficient incremental parsing
- Error detection and recovery in LR parsers

## Source
Information retrieved from: https://tree-sitter.github.io/tree-sitter/