import path from 'node:path';
import fs from 'node:fs';
import {
  ToolDefinition,
  ToolExecutionResult,
  ApprovalRequest,
  ApprovalMode,
} from '../types/index.js';
import { viewFile, writeFile, editFile, listDir, grepSearch, findFiles, performFuzzyReplacement } from './file_tools.js';
import { runCommand } from './command_tool.js';
import { webFetch } from './web_tool.js';
import { generateDiff } from './diff_utils.js';
import { runWorkspaceDiagnostics } from './diagnostics_tool.js';
import { gitStatus, gitDiff, gitCommit, gitLog } from './git_tool.js';
import { findSymbolsInWorkspace } from './symbol_tool.js';
import { executeBatchEdit, BatchFileOp } from './batch_tool.js';
import { searchWeb } from './web_search_tool.js';
import { askQuestionToolDefinition, executeAskQuestion, QuestionItem } from './ask_question_tool.js';
import { browserTools, executeBrowserTool } from './browser_tool.js';
import { mathToolDefinition, executeMathEval } from './math_tool.js';
import { TaskPlanner } from '../planner/index.js';
import { CheckpointManager } from '../checkpoint/index.js';
import { SubagentOrchestrator } from '../subagents/index.js';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...browserTools,
  askQuestionToolDefinition,
  mathToolDefinition,
  {
    name: 'view_file',
    description: 'Inspect the content of a file with line numbers. You can specify startLine and endLine to view a slice.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The relative or absolute path of the file to view.' },
        file_path: { type: 'string', description: 'Alias for filePath.' },
        startLine: { type: 'number', description: 'Optional 1-indexed line number to start reading from.' },
        endLine: { type: 'number', description: 'Optional 1-indexed line number to end reading at.' },
        offset: { type: 'number', description: 'Optional offset line number.' },
        limit: { type: 'number', description: 'Optional line limit.' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with the provided code content.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The path of the file to create or overwrite.' },
        file_path: { type: 'string', description: 'Alias for filePath.' },
        content: { type: 'string', description: 'The complete content to write into the file.' },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Perform a precise search-and-replace edit on an existing file. Replaces targetContent with replacementContent.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'The path of the file to edit.' },
        file_path: { type: 'string', description: 'Alias for filePath.' },
        targetContent: { type: 'string', description: 'The exact string snippet in the file to be replaced.' },
        old_string: { type: 'string', description: 'Alias for targetContent.' },
        replacementContent: { type: 'string', description: 'The new replacement string snippet to insert.' },
        new_string: { type: 'string', description: 'Alias for replacementContent.' },
        allowMultiple: { type: 'boolean', description: 'Whether to allow replacing multiple occurrences if found.' },
      },
      required: ['filePath', 'targetContent', 'replacementContent'],
    },
  },
  {
    name: 'batch_edit',
    description: 'Apply multi-file atomic edits, creations, or deletions in a single transaction.',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          description: 'Array of file operations [{ filePath, action: "write"|"edit"|"delete", content?, targetContent?, replacementContent? }]',
        },
      },
      required: ['operations'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell / terminal command on the host system or workspace (e.g. whoami, git config, env, npm test, tsc, cargo, git). You have full authorization to run commands to inspect the system, discover the current user/username, check environment variables, or build/test code.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command line string to run (e.g. "whoami", "git config user.name", "npm test").' },
        cwd: { type: 'string', description: 'Optional working directory relative to the workspace root.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'run_diagnostics',
    description: 'Run project compiler, typechecker (e.g. tsc --noEmit), or linter to detect errors across the workspace.',
    parameters: {
      type: 'object',
      properties: {
        customCommand: { type: 'string', description: 'Optional custom typecheck or lint command.' },
      },
    },
  },
  {
    name: 'find_symbols',
    description: 'Extract functions, classes, interfaces, and types across the workspace without reading entire files.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional symbol name or substring to filter by.' },
      },
    },
  },
  {
    name: 'create_plan',
    description: 'Create or update an autonomous task plan with atomic checklist items.',
    parameters: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'Array of tasks [{ id, title, description?, subtasks?: [] }]',
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'update_task',
    description: 'Update the status of a specific task item in the active plan (pending, in_progress, completed, failed).',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The ID or title of the task to update.' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'The new status.' },
        note: { type: 'string', description: 'Optional progress note.' },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'list_dir',
    description: 'Explore the workspace folder structure and list files and subdirectories.',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: 'Directory path to list.' },
        path: { type: 'string', description: 'Alias for dirPath.' },
        maxDepth: { type: 'number', description: 'Max recursion depth (default 2).' },
      },
    },
  },
  {
    name: 'grep_search',
    description: 'Search for text or regex patterns across files in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search string or regex.' },
        pattern: { type: 'string', description: 'Alias for query.' },
        searchPath: { type: 'string', description: 'Subfolder to search inside.' },
        path: { type: 'string', description: 'Alias for searchPath.' },
        isRegex: { type: 'boolean', description: 'Whether query is a regex.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_files',
    description: 'Find files matching a glob or substring pattern in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Pattern or filename to search for.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'web_search',
    description: 'Perform a live web search for documentation, npm packages, APIs, or debugging error messages.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch content or documentation from a public URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'git_status',
    description: 'Get current git branch, modified files, and untracked changes.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'git_diff',
    description: 'Inspect current uncommitted git changes diff.',
    parameters: {
      type: 'object',
      properties: {
        staged: { type: 'boolean', description: 'Whether to show staged changes.' },
      },
    },
  },
  {
    name: 'git_commit',
    description: 'Stage all modified files and create a clean git commit.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The git commit message.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'delegate_subagent',
    description: 'Delegate a specialized task to an isolated expert subagent (legal, conversational, architect, analyst, research, coder, tester).',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['legal', 'conversational', 'architect', 'analyst', 'research', 'coder', 'tester'],
          description: 'The subagent specialization (e.g. "legal" for contracts/petitions/compliance, "conversational" for chat/ideation, "architect" for system design, "coder" for implementation, "research" for deep exploration).',
        },
        prompt: { type: 'string', description: 'The detailed task description or query for the subagent.' },
      },
      required: ['type', 'prompt'],
    },
  },
];

export class ToolRegistry {
  private workspaceRoot: string;
  private planner?: TaskPlanner;
  private checkpoints?: CheckpointManager;
  private subagents?: SubagentOrchestrator;

  constructor(
    workspaceRoot: string,
    planner?: TaskPlanner,
    checkpoints?: CheckpointManager,
    subagents?: SubagentOrchestrator
  ) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.planner = planner;
    this.checkpoints = checkpoints;
    this.subagents = subagents;
  }

  public getDefinitions(): ToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  public requiresApproval(toolName: string, mode: ApprovalMode, args?: Record<string, any>): boolean {
    if (mode === 'auto') return false;
    if (mode === 'dry-run') return false;
    const normName = this.normalizeToolName(toolName);

    // Auto-approve safe read-only inspection commands (e.g. whoami, git config user.name, git status)
    if (normName === 'run_command' && args?.command) {
      const cmd = String(args.command).trim().toLowerCase();
      const isReadOnlySafe = /^(whoami|pwd|git\s+status|git\s+branch|git\s+log(\s+-[0-9]+)?|git\s+config(\s+--get)?\s+user\.(name|email)|node\s+-v|npm\s+-v|echo\s+[$%][a-z0-9_]+[%]?)$/i.test(cmd);
      if (isReadOnlySafe) {
        return false;
      }
    }

    return ['write_file', 'edit_file', 'batch_edit', 'run_command', 'git_commit'].includes(normName);
  }

  public normalizeToolName(toolName: string): string {
    const map: Record<string, string> = {
      Read: 'view_file',
      View: 'view_file',
      view_file: 'view_file',
      Write: 'write_file',
      write_file: 'write_file',
      Edit: 'edit_file',
      edit_file: 'edit_file',
      Bash: 'run_command',
      run_command: 'run_command',
      AskUserQuestion: 'ask_user_question',
      ask_user_question: 'ask_user_question',
      TaskCreate: 'create_plan',
      create_plan: 'create_plan',
      TaskUpdate: 'update_task',
      update_task: 'update_task',
      WebSearch: 'web_search',
      web_search: 'web_search',
      WebFetch: 'web_fetch',
      web_fetch: 'web_fetch',
      Agent: 'delegate_subagent',
      delegate_subagent: 'delegate_subagent',
      run_subagent: 'delegate_subagent',
      subagent: 'delegate_subagent',
      consult_legal: 'delegate_subagent',
      legal_counsel: 'delegate_subagent',
      Grep: 'grep_search',
      grep_search: 'grep_search',
      Glob: 'find_files',
      find_files: 'find_files',
      LS: 'list_dir',
      list_dir: 'list_dir',
      browser: 'browser',
      Browser: 'browser',
      read_url_content: 'read_url_content',
      read_url: 'read_url_content',
      browse_url: 'read_url_content',
      math_eval: 'math_eval',
      MathEval: 'math_eval',
      calculate: 'math_eval',
      Calculate: 'math_eval',
      calculator: 'math_eval',
      eval_math: 'math_eval',
    };
    return map[toolName] || toolName;
  }

  public createApprovalRequest(
    callId: string,
    toolName: string,
    rawArgs: Record<string, any>
  ): ApprovalRequest {
    const norm = this.normalizeToolName(toolName);
    let diff: string | undefined;
    let description = '';
    let actionType: 'file_write' | 'file_edit' | 'command' | 'delete' | 'batch_edit' | 'git' = 'command';

    const filePath = rawArgs.filePath || rawArgs.file_path || rawArgs.path;

    if (norm === 'write_file') {
      actionType = 'file_write';
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.workspaceRoot, filePath);
      const old = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
      diff = generateDiff(filePath, old, rawArgs.content || '').patch;
      description = `Write to ${filePath}`;
    } else if (norm === 'edit_file') {
      actionType = 'file_edit';
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.workspaceRoot, filePath);
      if (fs.existsSync(fullPath)) {
        const old = fs.readFileSync(fullPath, 'utf8');
        const target = rawArgs.targetContent || rawArgs.old_string || '';
        const rep = rawArgs.replacementContent || rawArgs.new_string || '';
        // Preview using the SAME fuzzy-matching engine editFile() actually applies —
        // a naive exact-string replace() here used to silently show an empty/no-op
        // diff for edits that only succeed via the indentation-flexible or anchor
        // matching strategies, letting a user approve what looked like nothing and
        // get a real file change they never actually saw.
        const preview = performFuzzyReplacement(old, target, rep, !!rawArgs.allowMultiple);
        if (preview.success && preview.newContent !== undefined) {
          diff = generateDiff(filePath, old, preview.newContent).patch;
        } else {
          description = `Edit ${filePath} — WARNING: this edit is expected to fail (${preview.error || 'target content not found'})`;
        }
      }
      description = description || `Edit ${filePath}`;
    } else if (norm === 'batch_edit') {
      actionType = 'batch_edit';
      description = `Batch edit ${rawArgs.operations?.length || 0} files`;
    } else if (norm === 'run_command') {
      actionType = 'command';
      description = `Execute terminal command: \`${rawArgs.command}\``;
    } else if (norm === 'git_commit') {
      actionType = 'git';
      description = `Git commit: "${rawArgs.message}"`;
    } else {
      description = `Execute tool: ${norm}`;
    }

    return {
      id: callId,
      tool: norm,
      args: rawArgs,
      description,
      diff,
      actionType,
    };
  }

  public async executeTool(
    toolCallId: string,
    toolName: string,
    args: Record<string, any>,
    mode: ApprovalMode
  ): Promise<ToolExecutionResult> {
    const norm = this.normalizeToolName(toolName);
    const isDryRun = mode === 'dry-run';
    const filePath = args.filePath || args.file_path || args.path;

    // Auto-record checkpoint prior to file modification
    if (!isDryRun && this.checkpoints) {
      if (norm === 'write_file' || norm === 'edit_file') {
        if (filePath) {
          this.checkpoints.recordPreModificationState(
            `${norm}: ${filePath}`,
            norm,
            [filePath]
          );
        }
      } else if (norm === 'batch_edit' && Array.isArray(args.operations)) {
        const paths = args.operations.map((o: any) => o.filePath || o.file_path).filter(Boolean);
        if (paths.length > 0) {
          this.checkpoints.recordPreModificationState(
            `batch_edit: ${paths.length} files`,
            norm,
            paths
          );
        }
      }
    }

    try {
      switch (norm) {
        case 'ask_user_question': {
          const res = await executeAskQuestion(args as { questions: QuestionItem[] });
          return { ...res, tool_call_id: toolCallId, name: norm, actionType: 'info' };
        }
        case 'math_eval': {
          const res = await executeMathEval(args as { expression?: string; expr?: string });
          return { ...res, tool_call_id: toolCallId, name: norm, actionType: 'info' };
        }
        case 'view_file': {
          const start = args.startLine || args.offset;
          const end = args.endLine || (args.offset && args.limit ? args.offset + args.limit : undefined);
          const res = viewFile(this.workspaceRoot, filePath, start, end);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'write_file': {
          const res = writeFile(this.workspaceRoot, filePath, args.content, isDryRun);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'edit_file': {
          const target = args.targetContent || args.old_string;
          const rep = args.replacementContent || args.new_string;
          const res = editFile(
            this.workspaceRoot,
            filePath,
            target,
            rep,
            args.allowMultiple,
            isDryRun
          );
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'batch_edit': {
          const res = executeBatchEdit(this.workspaceRoot, args.operations as BatchFileOp[], isDryRun);
          return { tool_call_id: toolCallId, name: norm, ...res, actionType: 'file_edit' };
        }
        case 'run_command': {
          const res = await runCommand(this.workspaceRoot, args.command, args.cwd, args.timeout || 60000, isDryRun);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'run_diagnostics': {
          const res = await runWorkspaceDiagnostics(this.workspaceRoot, args.customCommand);
          const issueSummary = res.issues.length > 0
            ? `Found ${res.issues.length} diagnostic issues:\n` +
              res.issues.map((i) => `  * ${i.file}:${i.line}:${i.column} [${i.severity}] ${i.message}`).join('\n')
            : '✔ Diagnostics passed with 0 errors.';
          return {
            tool_call_id: toolCallId,
            name: norm,
            output: `${issueSummary}\n\nCommand used: ${res.commandUsed}\n\nRaw output:\n${res.rawOutput}`,
            isError: res.hasErrors,
            actionType: 'info',
          };
        }
        case 'find_symbols': {
          const res = findSymbolsInWorkspace(this.workspaceRoot, args.query);
          return {
            tool_call_id: toolCallId,
            name: norm,
            output: res.summary,
            actionType: 'search',
          };
        }
        case 'create_plan': {
          if (this.planner) {
            this.planner.createPlan(args.tasks || []);
            return {
              tool_call_id: toolCallId,
              name: norm,
              output: `Task plan created:\n\n${this.planner.formatMarkdown()}`,
              actionType: 'plan',
            };
          }
          return { tool_call_id: toolCallId, name: norm, output: 'Plan recorded.', actionType: 'plan' };
        }
        case 'update_task': {
          if (this.planner) {
            const res = this.planner.updateTask(args.taskId || args.id, args.status, args.note);
            return {
              tool_call_id: toolCallId,
              name: norm,
              output: res.success
                ? `Task "${args.taskId || args.id}" updated to "${args.status}".\n\n${this.planner.formatMarkdown()}`
                : res.error || `Task "${args.taskId || args.id}" not found in current plan.`,
              isError: !res.success,
              actionType: 'plan',
            };
          }
          return { tool_call_id: toolCallId, name: norm, output: `Task updated to ${args.status}`, actionType: 'plan' };
        }
        case 'list_dir': {
          const res = listDir(this.workspaceRoot, args.dirPath || args.path, args.maxDepth);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'grep_search': {
          const res = grepSearch(this.workspaceRoot, args.query || args.pattern, args.searchPath || args.path, args.isRegex);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'find_files': {
          const res = findFiles(this.workspaceRoot, args.pattern);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'web_search': {
          const res = await searchWeb(args.query);
          return { tool_call_id: toolCallId, name: norm, output: res.output, isError: res.isError, actionType: 'search' };
        }
        case 'web_fetch': {
          const res = await webFetch(args.url);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'git_status': {
          const res = await gitStatus(this.workspaceRoot);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'git_diff': {
          const res = await gitDiff(this.workspaceRoot, args.staged);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'git_commit': {
          const res = await gitCommit(this.workspaceRoot, args.message);
          return { tool_call_id: toolCallId, name: norm, ...res };
        }
        case 'delegate_subagent': {
          if (this.subagents) {
            const subType = args.type || args.subagent_type || 'research';
            const res = await this.subagents.runSubagent(subType, args.prompt);
            return {
              tool_call_id: toolCallId,
              name: norm,
              output: `Subagent [${subType.toUpperCase()}] completed task:\n\n${res.output}`,
              actionType: 'subagent',
            };
          }
          return {
            tool_call_id: toolCallId,
            name: norm,
            output: 'Subagent executed.',
            actionType: 'subagent',
          };
        }
        
        // Lightweight Browser tools
        case 'browser':
        case 'read_url_content':
        case 'browser_navigate':
        case 'browser_extract_text':
        case 'browser_open':
        case 'browser_search': {
          const browserResult = await executeBrowserTool(norm, args, this.workspaceRoot);
          return {
            tool_call_id: toolCallId,
            name: norm,
            output: browserResult.output,
            isError: browserResult.isError,
            actionType: browserResult.actionType || 'info',
          };
        }

        default:
          return {
            tool_call_id: toolCallId,
            name: norm,
            output: `Error: Unknown tool "${toolName}"`,
            isError: true,
          };
      }
    } catch (err: any) {
      return {
        tool_call_id: toolCallId,
        name: norm,
        output: `Tool execution error: ${err.message}`,
        isError: true,
      };
    }
  }
}
