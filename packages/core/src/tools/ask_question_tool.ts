import { ToolDefinition, ToolExecutionResult } from '../types/index.js';

export interface QuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect?: boolean;
}

export const askQuestionToolDefinition: ToolDefinition = {
  name: 'ask_user_question',
  description:
    'Use this tool when you are blocked on an architectural or requirement decision that requires user clarification before proceeding with code modifications. Ask 1-3 targeted, concise questions with structured options.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Array of 1-3 targeted questions to ask the user',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask the user',
            },
            header: {
              type: 'string',
              description: 'Short tag/chip header (e.g. "Auth Method", "Database", "Design")',
            },
            options: {
              type: 'array',
              description: 'List of 2-4 distinct choices',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: 'Display label for the option',
                  },
                  description: {
                    type: 'string',
                    description: 'Explanation or implications of this option',
                  },
                  preview: {
                    type: 'string',
                    description: 'Optional ASCII mockup, code snippet, or visual preview',
                  },
                },
                required: ['label', 'description'],
              },
            },
            multiSelect: {
              type: 'boolean',
              description: 'Allow multiple selections',
            },
          },
          required: ['question', 'header', 'options'],
        },
      },
    },
    required: ['questions'],
  },
};

export async function executeAskQuestion(
  args: { questions: QuestionItem[] }
): Promise<ToolExecutionResult> {
  const qList = args.questions || [];
  const formatted = qList
    .map((q, idx) => {
      const opts = q.options
        .map((o, i) => `   ${String.fromCharCode(65 + i)}) **${o.label}**: ${o.description}`)
        .join('\n');
      return `### Question ${idx + 1} [${q.header}]:\n**${q.question}**\n${opts}`;
    })
    .join('\n\n');

  return {
    tool_call_id: '',
    name: 'ask_user_question',
    output: `Presented ${qList.length} clarifying question(s) to the user:\n\n${formatted}`,
    isError: false,
  };
}
