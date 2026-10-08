import * as vscode from 'vscode';
import * as path from 'path';

export interface EditorContext {
  hasEditor: boolean;
  fileName?: string;
  relativePath?: string;
  languageId?: string;
  selectedText?: string;
  fileContent?: string;
  selectionRange?: {
    startLine: number;
    endLine: number;
  };
}

/**
 * Capture context from the currently active text editor.
 */
export function getActiveEditorContext(): EditorContext {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { hasEditor: false };
  }

  const document = editor.document;
  const selection = editor.selection;
  const fileName = path.basename(document.fileName);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const relativePath = workspaceFolder
    ? path.relative(workspaceFolder.uri.fsPath, document.fileName)
    : fileName;

  const selectedText = !selection.isEmpty ? document.getText(selection) : undefined;
  
  // Only capture whole file content if reasonable size (< 50KB) to prevent huge context
  let fileContent: string | undefined;
  if (!selectedText && document.getText().length < 50000) {
    fileContent = document.getText();
  }

  return {
    hasEditor: true,
    fileName,
    relativePath,
    languageId: document.languageId,
    selectedText,
    fileContent,
    selectionRange: !selection.isEmpty ? {
      startLine: selection.start.line + 1,
      endLine: selection.end.line + 1
    } : undefined
  };
}

/**
 * Insert code snippet at current editor cursor position.
 */
export async function insertCodeAtCursor(code: string): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor to insert code into.');
    return false;
  }

  return editor.edit(editBuilder => {
    editBuilder.insert(editor.selection.active, code);
  });
}

/**
 * Open a new untitled file in VS Code with the given content.
 */
export async function createNewFileWithContent(content: string, languageId?: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content,
    language: languageId || 'plaintext'
  });
  await vscode.window.showTextDocument(document, { preview: false });
}

/**
 * Format context text to be prepended to user prompt when context is attached.
 */
export function formatContextPrompt(context: EditorContext): string {
  if (!context.hasEditor) return '';

  const lines: string[] = [];
  lines.push(`[Active File: ${context.relativePath || context.fileName} (${context.languageId})]`);

  if (context.selectedText) {
    lines.push(`[Selected Code Lines ${context.selectionRange?.startLine}-${context.selectionRange?.endLine}]:`);
    lines.push('```' + (context.languageId || '') + '\n' + context.selectedText + '\n```');
  } else if (context.fileContent) {
    lines.push('[Full File Content]:');
    lines.push('```' + (context.languageId || '') + '\n' + context.fileContent + '\n```');
  }

  return lines.join('\n') + '\n\n';
}
