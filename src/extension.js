const vscode = require('vscode')
const { isInsideComment } = require('./commentDetector')

/** @type {boolean} */
let currentlyInComment = false

/** @type {NodeJS.Timeout | undefined} */
let hideInterval

/** @type {vscode.StatusBarItem | undefined} */
let statusBarItem

function activate(context) {
  setCopilotEnabled()

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  statusBarItem.tooltip = 'Copilot completions status'
  context.subscriptions.push(statusBarItem)
  updateStatusBar(false)
  statusBarItem.show()

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (!isEnabled()) return
      if (currentlyInComment) {
        vscode.commands.executeCommand('editor.action.inlineSuggest.hide')
      }
      checkCursorContext(event.textEditor)
    })
  )

  // Listen for active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!isEnabled()) return
      if (editor) {
        checkCursorContext(editor)
      }
    })
  )

  // Initial check
  if (vscode.window.activeTextEditor) {
    checkCursorContext(vscode.window.activeTextEditor)
  }
}

function checkCursorContext(editor) {
  if (!editor) return

  const document = editor.document
  const position = editor.selection.active
  const inComment = isInsideComment(document, position)

  if (inComment !== currentlyInComment) {
    currentlyInComment = inComment
    if (inComment) {
      setCopilotDisabled()
    } else {
      stopHideInterval()
      setCopilotEnabled()
    }
    updateStatusBar(inComment)
  }
}

function deactivate() {
  setCopilotEnabled()
  currentlyInComment = false
  stopHideInterval()
}

function isEnabled() {
  return vscode.workspace
    .getConfiguration('disableCopilotInComments')
    .get('enabled', true)
}

function setCopilotDisabled() {
  const config = vscode.workspace.getConfiguration('github.copilot')
  const current = config.get('enable') ?? {}
  config.update('enable', { ...current, '*': false }, vscode.ConfigurationTarget.Global)
  vscode.commands.executeCommand('editor.action.inlineSuggest.hide')
  startHideInterval()
}

function setCopilotEnabled() {
  const config = vscode.workspace.getConfiguration('github.copilot')
  const current = config.get('enable')
  if (typeof current !== 'object' || current === null) return
  const updated = { ...current }
  delete updated['*']
  config.update(
    'enable',
    Object.keys(updated).length ? updated : undefined,
    vscode.ConfigurationTarget.Global
  )
}

function startHideInterval() {
  stopHideInterval()
  // Copilot suggestions are computed asynchronously and may arrive after the
  // config write. Fire hide repeatedly for 2 seconds to catch them.
  const deadline = Date.now() + 2000
  hideInterval = setInterval(() => {
    if (!currentlyInComment || Date.now() >= deadline) {
      stopHideInterval()
      return
    }
    vscode.commands.executeCommand('editor.action.inlineSuggest.hide')
  }, 150)
}

function stopHideInterval() {
  if (hideInterval) {
    clearInterval(hideInterval)
    hideInterval = undefined
  }
}

function updateStatusBar(inComment) {
  if (!statusBarItem) return
  if (inComment) {
    statusBarItem.text = '$(circle-slash) Copilot: paused'
  } else {
    statusBarItem.text = '$(check) Copilot: active'
  }
}

module.exports = { activate, deactivate }
