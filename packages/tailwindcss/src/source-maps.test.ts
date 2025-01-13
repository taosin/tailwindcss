import dedent from 'dedent'
import { assert, expect, test } from 'vitest'
import { toCss, type AstNode } from './ast'
import * as CSS from './css-parser'
import { computeLineTable } from './source-maps'

async function generate(input: string) {
  let ast = CSS.parse(input, true)
  let css = toCss(ast, true)

  return { ast, css }
}

// Parse CSS and make sure source locations are tracked correctly
test('comment, single line', async () => {
  // Works, no changes needed
  let { ast } = await generate(`/*! foo */`)

  assert(ast[0].kind === 'comment')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "value": "0:0-0:10 <- 0:0-0:10",
    }
  `)
})

test('comment, multi line', async () => {
  // Works, no changes needed
  let { ast } = await generate(`/*! foo \n bar */`)

  assert(ast[0].kind === 'comment')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "value": "0:0-1:7 <- 0:0-1:7",
    }
  `)
})

test('declaration, normal property, single line', async () => {
  let { ast } = await generate(`.foo { color: red; }`)

  assert(ast[0].kind === 'rule')
  assert(ast[0].nodes[0].kind === 'declaration')
  expect(annotate(ast[0].nodes[0])).toMatchInlineSnapshot(`
    {
      "property": "1:2-1:7 <- 0:7-0:7",
      "value": "1:9-1:12 <- 0:7-0:7",
    }
  `)
})

test('declaration, normal property, multi line', async () => {
  let { ast, css } = await generate(`
      .foo {
        grid-template-areas:
          "a b c"
          "d e f"
          "g h i";
      }
    `)

  assert(ast[0].kind === 'rule')
  assert(ast[0].nodes[0].kind === 'declaration')
  expect(annotate(ast[0].nodes[0])).toMatchInlineSnapshot(`
    {
      "property": "1:2-1:21 <- 2:9-2:9",
      "value": "1:23-1:46 <- 2:9-2:9",
    }
  `)

  expect(css).toMatchInlineSnapshot(`
    ".foo {
      grid-template-areas: "a b c" "d e f" "g h i";
    }
    "
  `)
})

test('declaration, custom property, single line', async () => {
  let { ast, css } = await generate(`.foo { --foo: bar; }`)

  assert(ast[0].kind === 'rule')
  assert(ast[0].nodes[0].kind === 'declaration')
  expect(annotate(ast[0].nodes[0])).toMatchInlineSnapshot(`
    {
      "property": "1:2-1:7 <- 0:7-0:5",
      "value": "1:9-1:12 <- 0:14-0:17",
    }
  `)
  expect(css).toMatchInlineSnapshot(`
    ".foo {
      --foo: bar;
    }
    "
  `)
})

test('declaration, custom property, multi line', async () => {
  let { ast } = await generate(`
    .foo {
      --foo: bar\nbaz;
    }
  `)

  assert(ast[0].kind === 'rule')
  assert(ast[0].nodes[0].kind === 'declaration')
  expect(annotate(ast[0].nodes[0])).toMatchInlineSnapshot(`
    {
      "property": "1:2-1:7 <- 2:7-2:-6",
      "value": "1:9-2:3 <- 2:14-3:3",
    }
  `)
})

test('at rules, bodyless, single line', async () => {
  let { ast } = await generate(`@layer foo,     bar;`)

  assert(ast[0].kind === 'at-rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "(none) <- 0:6-0:0",
      "name": "0:0-0:6 <- 0:6-0:0",
      "params": "0:7-0:15 <- 0:6-0:0",
    }
  `)
})

test('at rules, bodyless, multi line', async () => {
  let { ast } = await generate(`
    @layer
      foo,
      bar
    ;
  `)

  assert(ast[0].kind === 'at-rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "(none) <- 0:6-1:5",
      "name": "0:0-0:6 <- 0:6-1:5",
      "params": "0:7-0:15 <- 0:6-1:5",
    }
  `)
})

test('at rules, body, single line', async () => {
  let { ast, css } = await generate(`@layer foo { color: red; }`)

  assert(ast[0].kind === 'at-rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "0:11-2:1 <- 0:0-0:25",
      "name": "0:0-0:6 <- 0:0-0:0",
      "params": "0:7-0:10 <- 0:0-0:0",
    }
  `)
  expect(css).toMatchInlineSnapshot(`
    "@layer foo {
      color: red;
    }
    "
  `)
})

test('at rules, body, multi line {d', async () => {
  let { ast, css } = await generate(`
    @layer
      foo
    {
      color: baz;
    }
  `)

  assert(ast[0].kind === 'at-rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "0:11-2:1 <- 1:5-5:5",
      "name": "0:0-0:6 <- 1:5-1:5",
      "params": "0:7-0:10 <- 1:5-1:5",
    }
  `)
  expect(css).toMatchInlineSnapshot(`
    "@layer foo {
      color: baz;
    }
    "
  `)
})

test('style rules, body, single line', async () => {
  let { ast, css } = await generate(`.foo:is(.bar) { color: red; }`)

  assert(ast[0].kind === 'rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "0:14-2:1 <- 0:0-0:28",
      "selector": "0:0-0:13 <- 0:0-0:0",
    }
  `)
  expect(css).toMatchInlineSnapshot(`
    ".foo:is(.bar) {
      color: red;
    }
    "
  `)
})

test('style rules, body, multi line', async () => {
  let { ast, css } = await generate(`
    .foo:is(
      .bar
    ) {
      color: red;
    }
  `)

  assert(ast[0].kind === 'rule')
  expect(annotate(ast[0])).toMatchInlineSnapshot(`
    {
      "body": "0:16-2:1 <- 1:5-5:5",
      "selector": "0:0-0:15 <- 1:5-1:5",
    }
  `)

  expect(css).toMatchInlineSnapshot(`
    ".foo:is( .bar ) {
      color: red;
    }
    "
  `)
})

// function run(rawCss: string, candidates: string[] = []) {
//   let source = new MagicString(rawCss)

//   let bundle = new Bundle()

//   bundle.addSource({
//     filename: 'source.css',
//     content: source,
//   })

//   let originalMap = Object.assign(
//     bundle.generateDecodedMap({
//       hires: 'boundary',
//       file: 'source.css.map',
//       includeContent: true,
//     }),
//     {
//       version: 3 as const,
//     },
//   )

//   let compiler = compile(source.toString(), { map: true })

//   let css = compiler.build(candidates)
//   let map = compiler.buildSourceMap()

//   let combined = remapping([map as any, originalMap], () => null)

//   let sources = combined.sources
//   let annotations = annotatedMappings(map)

//   return { css, map, sources, annotations }
// }

// test('source locations are tracked during parsing and serializing', async () => {
//   let ast = CSS.parse(`.foo { color: red; }`, true)
//   toCss(ast, true)

//   if (ast[0].kind !== 'rule') throw new Error('Expected a rule')

//   let rule = annotate(ast[0])
//   expect(rule).toMatchInlineSnapshot(`
//     {
//       "node": [
//         "1:1-1:5",
//         "3:1-3:1",
//       ],
//     }
//   `)

//   let decl = annotate(ast[0].nodes[0])
//   expect(decl).toMatchInlineSnapshot(`
//     {
//       "node": [
//         "1:8-1:18",
//         "2:3-2:13",
//       ],
//     }
//   `)
// })

// test('utilities have source maps pointing to the utilities node', async () => {
//   let { sources, annotations } = run(`@tailwind utilities;`, [
//     //
//     'underline',
//   ])

//   // All CSS generated by Tailwind CSS should be annotated with source maps
//   // And always be able to point to the original source file
//   expect(sources).toEqual(['source.css'])
//   expect(sources.length).toBe(1)

//   expect(annotations).toEqual([
//     //
//     '1:1-11 <- 1:1-20',
//     '2:3-34 <- 1:1-20',
//   ])
// })

// test('@apply generates source maps', async () => {
//   let { sources, annotations } = run(`.foo {
//   color: blue;
//   @apply text-[#000] hover:text-[#f00];
//   @apply underline;
//   color: red;
// }`)

//   // All CSS generated by Tailwind CSS should be annotated with source maps
//   // And always be able to point to the original source file
//   expect(sources).toEqual(['source.css'])
//   expect(sources.length).toBe(1)

//   expect(annotations).toEqual([
//     '1:1-5 <- 1:1-5',
//     '2:3-14 <- 2:3-14',
//     '3:3-14 <- 3:3-39',
//     '4:3-10 <- 3:3-39',
//     '5:5-16 <- 3:3-39',
//     '7:3-34 <- 4:3-19',
//     '8:3-13 <- 5:3-13',
//   ])
// })

// test('license comments preserve source locations', async () => {
//   let { sources, annotations } = run(`/*! some comment */`)

//   // All CSS generated by Tailwind CSS should be annotated with source maps
//   // And always be able to point to the original source file
//   expect(sources).toEqual(['source.css'])
//   expect(sources.length).toBe(1)

//   expect(annotations).toEqual(['1:1-19 <- 1:1-19'])
// })

// test('license comments with new lines preserve source locations', async () => {
//   let { sources, annotations, css } = run(`/*! some \n comment */`)

//   // All CSS generated by Tailwind CSS should be annotated with source maps
//   // And always be able to point to the original source file
//   expect(sources).toEqual(['source.css'])
//   expect(sources.length).toBe(1)

//   expect(annotations).toEqual(['1:1 <- 1:1', '2:11 <- 2:11'])
// })

type Annotations = Record<string, string>

/**
 * An string annotation that represents one or more source locations
 */
function annotate(node: AstNode): Annotations {
  let res: Annotations = {}

  for (let [kind, mapping] of Object.entries(node.map)) {
    let srcRange = mapping.src
    let src = `${srcRange[0].line}:${srcRange[0].column}-${srcRange[1].line}:${srcRange[1].column}`

    let dstRange = mapping.dst
    let dst = dstRange
      ? `${dstRange[0].line}:${dstRange[0].column}-${dstRange[1].line}:${dstRange[1].column}`
      : '(none)'

    res[kind] = `${dst} <- ${src}`
  }

  return res
}

// /**
//  * An string annotation that represents a source map
//  *
//  * It's not meant to be exhaustive just enough to
//  * verify that the source map is working and that
//  * lines are mapped back to the original source
//  *
//  * Including when using @apply with multiple classes
//  */
// function annotatedMappings(map: RawSourceMap) {
//   const smc = new SourceMapConsumer(map)
//   const annotations: Record<
//     number,
//     {
//       original: { start: [number, number]; end: [number, number] }
//       generated: { start: [number, number]; end: [number, number] }
//     }
//   > = {}

//   smc.eachMapping((mapping) => {
//     let annotation = (annotations[mapping.generatedLine] = annotations[mapping.generatedLine] || {
//       ...mapping,

//       original: {
//         start: [mapping.originalLine, mapping.originalColumn],
//         end: [mapping.originalLine, mapping.originalColumn],
//       },

//       generated: {
//         start: [mapping.generatedLine, mapping.generatedColumn],
//         end: [mapping.generatedLine, mapping.generatedColumn],
//       },
//     })

//     annotation.generated.end[0] = mapping.generatedLine
//     annotation.generated.end[1] = mapping.generatedColumn

//     annotation.original.end[0] = mapping.originalLine
//     annotation.original.end[1] = mapping.originalColumn
//   })

//   return Object.values(annotations).map((annotation) => {
//     return `${formatRange(annotation.generated)} <- ${formatRange(annotation.original)}`
//   })
// }

// function formatRange(range: { start: [number, number]; end: [number, number] }) {
//   if (range.start[0] === range.end[0]) {
//     // This range is on the same line
//     // and the columns are the same
//     if (range.start[1] === range.end[1]) {
//       return `${range.start[0]}:${range.start[1]}`
//     }

//     // This range is on the same line
//     // but the columns are different
//     return `${range.start[0]}:${range.start[1]}-${range.end[1]}`
//   }

//   // This range spans multiple lines
//   return `${range.start[0]}:${range.start[1]}-${range.end[0]}:${range.end[1]}`
// }

const css = dedent

test('line tables', () => {
  let text = css`
    .foo {
      color: red;
    }
  `

  let table = computeLineTable(`${text}\n`)

  let start = process.hrtime.bigint()
  for (let i = 0; i < 1_000_000; ++i) {
    table.find(0)
    table.find(1)
    table.find(2)
    table.find(3)
    table.find(4)
    table.find(5)
    table.find(6)
    table.find(6 + 1)
    table.find(6 + 2)
    table.find(6 + 3)
    table.find(6 + 4)
    table.find(6 + 5)
    table.find(6 + 6)
    table.find(6 + 7)
    table.find(6 + 8)
    table.find(6 + 9)
    table.find(6 + 10)
    table.find(6 + 11)
    table.find(6 + 12)
    table.find(6 + 13)
    table.find(20 + 1)
    table.find(20 + 2)
    table.find(22 + 1)
  }
  let elapsed = process.hrtime.bigint() - start
  console.log(`Elapsed: ${Number(elapsed) / 1_000_000}ms`)

  // Line 1: `.foo {\n`
  expect(table.find(0)).toEqual({ line: 1, column: 1 })
  expect(table.find(1)).toEqual({ line: 1, column: 2 })
  expect(table.find(2)).toEqual({ line: 1, column: 3 })
  expect(table.find(3)).toEqual({ line: 1, column: 4 })
  expect(table.find(4)).toEqual({ line: 1, column: 5 })
  expect(table.find(5)).toEqual({ line: 1, column: 6 })
  expect(table.find(6)).toEqual({ line: 1, column: 7 })

  // Line 2: `  color: red;\n`
  expect(table.find(6 + 1)).toEqual({ line: 2, column: 1 })
  expect(table.find(6 + 2)).toEqual({ line: 2, column: 2 })
  expect(table.find(6 + 3)).toEqual({ line: 2, column: 3 })
  expect(table.find(6 + 4)).toEqual({ line: 2, column: 4 })
  expect(table.find(6 + 5)).toEqual({ line: 2, column: 5 })
  expect(table.find(6 + 6)).toEqual({ line: 2, column: 6 })
  expect(table.find(6 + 7)).toEqual({ line: 2, column: 7 })
  expect(table.find(6 + 8)).toEqual({ line: 2, column: 8 })
  expect(table.find(6 + 9)).toEqual({ line: 2, column: 9 })
  expect(table.find(6 + 10)).toEqual({ line: 2, column: 10 })
  expect(table.find(6 + 11)).toEqual({ line: 2, column: 11 })
  expect(table.find(6 + 12)).toEqual({ line: 2, column: 12 })
  expect(table.find(6 + 13)).toEqual({ line: 2, column: 13 })

  // // // Line 3: `}\n`
  expect(table.find(20 + 1)).toEqual({ line: 3, column: 1 })
  expect(table.find(20 + 2)).toEqual({ line: 3, column: 2 })

  // After the new line
  expect(table.find(22 + 1)).toEqual({ line: 4, column: 1 })
})
