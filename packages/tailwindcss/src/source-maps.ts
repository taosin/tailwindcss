import { walk, type AstNode, type Offsets } from './ast'

const LINE_BREAK = 0x0a

/**
 * A position in source code
 */
interface Position {
  /** The line number, one-based */
  line: number

  /** The column/character number, one-based */
  column: number
}

/**
 * A mapping from an original position in source code to a generated position
 */
export interface Mapping {
  original: Position
  generated: Position
}

/**
 * A table that lets you turn an offset into a line number and column
 */
export interface LineTable {
  /**
   * Find the line/column position in the source code for a given offset
   *
   * @param offset The index for which to find the position
   */
  find(offset: number): Position
}

/**
 * Compute a table of line numbers to their character offsets
 */
export function computeLineTable(text: string): LineTable {
  let table: number[] = [0]

  // To simplify calculations we store the offset of the first character
  // that we consider to be on the line, rather than the offset of the
  // line break itself.
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === LINE_BREAK) {
      table.push(i + 1)
    }
  }

  function find(offset: number) {
    // Based on esbuild's binary search for line numbers
    let line = 0
    let count = table.length
    while (count > 0) {
      // `| 0` causes integer division
      let mid = (count / 2) | 0
      let i = line + mid
      if (table[i] <= offset) {
        line = i + 1
        count = count - mid - 1
      } else {
        count = mid
      }
    }

    line -= 1

    let column = offset - table[line]

    return {
      line: line + 1,
      column: column + 1,
    }
  }

  return { find }
}

export function createSourceMap({
  original,
  generated,
  ast,
}: {
  original: string
  generated: string
  ast: AstNode[]
}) {
  // Compute line tables for both the original and generated source lazily so we
  // don't have to do it during parsing or printing.
  let originalMap = computeLineTable(original)
  let generatedMap = computeLineTable(generated)

  // Get all the indexes from the mappings
  let groups = new Set<Offsets | undefined>()

  walk(ast, (node) => {
    if (node.kind === 'declaration') {
      groups.add(node.offsets.property)
      groups.add(node.offsets.value)
    } else if (node.kind === 'rule') {
      groups.add(node.offsets.selector)
      groups.add(node.offsets.body)
    } else if (node.kind === 'at-rule') {
      groups.add(node.offsets.name)
      groups.add(node.offsets.params)
      groups.add(node.offsets.body)
    } else if (node.kind === 'comment') {
      groups.add(node.offsets.value)
    } else if (node.kind === 'at-root') {
      groups.add(node.offsets.body)
    }
  })

  // Convert each mapping to a set of positions
  let tmp: Mapping[] = []
  for (let group of groups) {
    if (!group) continue
    if (!group.dst) continue

    let originalStart = originalMap.find(group.src[0])
    let originalEnd = originalMap.find(group.src[1])

    let generatedStart = generatedMap.find(group.dst[0])
    let generatedEnd = generatedMap.find(group.dst[1])

    tmp.push(
      {
        original: originalStart,
        generated: originalEnd,
      },
      {
        original: generatedStart,
        generated: generatedEnd,
      },
    )
  }

  return tmp
}
