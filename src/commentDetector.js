// Maps VS Code language IDs to their comment delimiters.
const COMMENT_SYNTAX = {
  // Line comment only
  bash         : { line: '#' },
  coffeescript : { line: '#', block: ['###', '###'] },
  dockerfile   : { line: '#' },
  elixir       : { line: '#' },
  makefile     : { line: '#' },
  perl         : { line: '#' },
  powershell   : { line: '#', block: ['<#', '#>'] },
  python       : { line: '#' },
  r            : { line: '#' },
  ruby         : { line: '#' },
  shellscript  : { line: '#' },
  toml         : { line: '#' },
  yaml         : { line: '#' },
  zsh          : { line: '#' },

  // C-style: // and /* */
  c               : { line: '//', block: ['/*', '*/'] },
  cpp             : { line: '//', block: ['/*', '*/'] },
  csharp          : { line: '//', block: ['/*', '*/'] },
  dart            : { line: '//', block: ['/*', '*/'] },
  go              : { line: '//', block: ['/*', '*/'] },
  groovy          : { line: '//', block: ['/*', '*/'] },
  java            : { line: '//', block: ['/*', '*/'] },
  javascript      : { line: '//', block: ['/*', '*/'] },
  javascriptreact : { line: '//', block: ['/*', '*/'] },
  jsonc           : { line: '//', block: ['/*', '*/'] },
  kotlin          : { line: '//', block: ['/*', '*/'] },
  less            : { line: '//', block: ['/*', '*/'] },
  objective_c     : { line: '//', block: ['/*', '*/'] },
  'objective-c'   : { line: '//', block: ['/*', '*/'] },
  'objective-cpp' : { line: '//', block: ['/*', '*/'] },
  php             : { line: '//', block: ['/*', '*/'] },
  rust            : { line: '//', block: ['/*', '*/'] },
  scala           : { line: '//', block: ['/*', '*/'] },
  scss            : { line: '//', block: ['/*', '*/'] },
  swift           : { line: '//', block: ['/*', '*/'] },
  typescript      : { line: '//', block: ['/*', '*/'] },
  typescriptreact : { line: '//', block: ['/*', '*/'] },

  // CSS-style: /* */ only
  css : { block: ['/*', '*/'] },

  // HTML-style: <!-- -->
  html   : { block: ['<!--', '-->'] },
  svelte : { line: '//', block: ['/*', '*/'] },
  svg    : { block: ['<!--', '-->'] },
  vue    : { line: '//', block: ['/*', '*/'] },
  xml    : { block: ['<!--', '-->'] },

  // SQL
  sql : { line: '--', block: ['/*', '*/'] },

  // Lua
  lua : { line: '--', block: ['--[[', ']]'] },

  // Haskell
  haskell : { line: '--', block: ['{-', '-}'] },

  // Lisp family
  clojure : { line: ';' },
  lisp    : { line: ';' },
  scheme  : { line: ';' },

  // Other
  ada        : { line: '--' },
  erlang     : { line: '%' },
  fsharp     : { line: '//', block: ['(*', '*)'] },
  ini        : { line: ';' },
  latex      : { line: '%' },
  matlab     : { line: '%', block: ['%{', '%}'] },
  ocaml      : { block: ['(*', '*)'] },
  properties : { line: '#' },
  tex        : { line: '%' },
  vb         : { line: "'" },
}

// Returns true if the given position is inside a comment.
// Uses text-based heuristics (not a full parser) — works well in practice.
function isInsideComment(document, position) {
  const syntax = COMMENT_SYNTAX[document.languageId]
  if (!syntax) {
    return false
  }

  const line = document.lineAt(position.line)
  const textBeforeCursor = line.text.substring(0, position.character)

  // Line comment check
  if (syntax.line) {
    if (isInLineComment(textBeforeCursor, syntax.line, syntax.block)) {
      return true
    }
  }

  // Block comment check
  if (syntax.block) {
    if (isInBlockComment(document, position, syntax.block[0], syntax.block[1])) {
      return true
    }
  }

  return false
}

// Returns true if textBeforeCursor is inside a line comment,
// accounting for strings and inline block comments.
function isInLineComment(textBeforeCursor, lineMarker, blockSyntax) {
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateString = false

  for (let i = 0; i < textBeforeCursor.length; i++) {
    const ch = textBeforeCursor[i]
    const prev = i > 0 ? textBeforeCursor[i - 1] : ''

    // Skip escaped characters
    if (prev === '\\') continue

    // Track string state
      inSingleQuote = !inSingleQuote
      continue
    }
    if (ch === '"' && !inSingleQuote && !inTemplateString) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplateString = !inTemplateString
      continue
    }

    // If we're inside a string, skip
    if (inSingleQuote || inDoubleQuote || inTemplateString) continue

    // Check for block comment open/close (skip over block comments on the same line)
    if (blockSyntax) {
      const blockOpen = blockSyntax[0]
      const blockClose = blockSyntax[1]
      if (textBeforeCursor.substring(i, i + blockOpen.length) === blockOpen) {
        const closeIdx = textBeforeCursor.indexOf(blockClose, i + blockOpen.length)
        if (closeIdx !== -1) {
          i = closeIdx + blockClose.length - 1
          continue
        }
        // Unclosed block comment — handled by isInBlockComment
        return false
      }
    }

    // Check for line comment marker
    if (textBeforeCursor.substring(i, i + lineMarker.length) === lineMarker) {
      return true
    }
  }

  return false
}

// Returns true if the cursor is inside a block comment.
// Scans up to 5000 lines back from the cursor.
function isInBlockComment(document, position, blockOpen, blockClose) {
  const maxLookback = 5000
  const startLine = Math.max(0, position.line - maxLookback)

  let inBlock = false
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplateString = false

  for (let lineNum = startLine; lineNum <= position.line; lineNum++) {
    const lineObj = document.lineAt(lineNum)
    const text = lineNum === position.line
      ? lineObj.text.substring(0, position.character)
      : lineObj.text

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const prev = i > 0 ? text[i - 1] : ''

      if (inBlock) {
        // Look for block close
        if (text.substring(i, i + blockClose.length) === blockClose) {
          inBlock = false
          i += blockClose.length - 1
        }
        continue
      }

      // Skip escaped characters
      if (prev === '\\') continue

      // Track string state (only outside block comments)
      if (ch === "'" && !inDoubleQuote && !inTemplateString) {
        inSingleQuote = !inSingleQuote
        continue
      }
      if (ch === '"' && !inSingleQuote && !inTemplateString) {
        inDoubleQuote = !inDoubleQuote
        continue
      }
      if (ch === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplateString = !inTemplateString
        continue
      }

      if (inSingleQuote || inDoubleQuote || inTemplateString) continue

      // Look for block open
      if (text.substring(i, i + blockOpen.length) === blockOpen) {
        inBlock = true
        i += blockOpen.length - 1
        continue
      }
    }

    // Reset single/double quote state at line boundaries.
    // In most languages these don't span lines, so this is a safe heuristic.
    if (lineNum < position.line) {
      inSingleQuote = false
      inDoubleQuote = false
    }
  }

  return inBlock
}

module.exports = {
  isInsideComment,
  COMMENT_SYNTAX,
}
