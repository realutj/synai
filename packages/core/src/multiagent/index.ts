/**
 * Multi-Agent Collaboration System
 * Multiple AI agents discuss and solve problems together
 */

export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  systemPrompt: string;
}

export interface Message {
  agentId: string;
  agentName: string;
  content: string;
  timestamp: number;
  type: 'discussion' | 'proposal' | 'agreement' | 'final';
}

export interface CollaborationSession {
  id: string;
  topic: string;
  agents: Agent[];
  messages: Message[];
  status: 'active' | 'completed' | 'failed';
  result?: string;
}

/**
 * Default agent personas for collaboration
 */
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'architect',
    name: 'Alex (Architect)',
    role: 'System Designer',
    personality: 'Strategic, big-picture thinker, focuses on architecture and scalability',
    systemPrompt: `You are Alex, a senior software architect. You focus on:
- Overall system design and architecture
- Scalability and performance considerations
- Technology stack decisions
- Long-term maintainability
Be strategic and think about the big picture. Challenge ideas constructively.`,
  },
  {
    id: 'developer',
    name: 'Dev (Developer)',
    role: 'Implementation Expert',
    personality: 'Practical, detail-oriented, focuses on code quality and implementation',
    systemPrompt: `You are Dev, an experienced software developer. You focus on:
- Clean, maintainable code
- Implementation details and best practices
- Code patterns and refactoring
- Testing and debugging
Be practical and detail-oriented. Suggest concrete solutions.`,
  },
  {
    id: 'reviewer',
    name: 'Riley (Reviewer)',
    role: 'Quality Assurance',
    personality: 'Critical thinker, skeptical, focuses on edge cases and potential issues',
    systemPrompt: `You are Riley, a quality assurance engineer. You focus on:
- Finding potential bugs and edge cases
- Security vulnerabilities
- Performance bottlenecks
- User experience issues
Be skeptical and ask tough questions. Point out what could go wrong.`,
  },
];

/**
 * Orchestrates multi-agent collaboration
 */
export class MultiAgentOrchestrator {
  private sessions: Map<string, CollaborationSession> = new Map();

  /**
   * Start a new collaboration session
   */
  async startSession(
    topic: string,
    agents: Agent[] = DEFAULT_AGENTS,
    maxRounds: number = 5
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: `session_${Date.now()}`,
      topic,
      agents,
      messages: [],
      status: 'active',
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Add a message to the session
   */
  addMessage(sessionId: string, message: Omit<Message, 'timestamp'>): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.messages.push({
      ...message,
      timestamp: Date.now(),
    });
  }

  /**
   * Get conversation history for an agent
   */
  getConversationContext(sessionId: string, agentId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    const context = [`Topic: ${session.topic}\n\nDiscussion so far:\n`];

    session.messages.forEach((msg) => {
      context.push(`${msg.agentName}: ${msg.content}\n`);
    });

    return context.join('\n');
  }

  /**
   * Check if agents have reached consensus
   */
  hasReachedConsensus(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if recent messages indicate agreement
    const recentMessages = session.messages.slice(-3);
    const agreementKeywords = ['agree', 'sounds good', 'makes sense', 'lets proceed', 'approved'];

    return recentMessages.every((msg) =>
      agreementKeywords.some((keyword) => msg.content.toLowerCase().includes(keyword))
    );
  }

  /**
   * Complete the session with final result
   */
  completeSession(sessionId: string, result: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.result = result;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }
}

/**
 * Format collaboration session for display
 */
export function formatCollaborationOutput(session: CollaborationSession): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`🤝 MULTI-AGENT COLLABORATION`);
  lines.push(`Topic: ${session.topic}`);
  lines.push('═══════════════════════════════════════════════════════\n');

  lines.push('Participants:');
  session.agents.forEach((agent) => {
    lines.push(`  • ${agent.name} — ${agent.role}`);
  });
  lines.push('');

  lines.push('Discussion:\n');
  session.messages.forEach((msg, index) => {
    const icon = msg.type === 'final' ? '✅' : msg.type === 'proposal' ? '💡' : '💬';
    lines.push(`${icon} ${msg.agentName}:`);
    lines.push(`   ${msg.content}\n`);
  });

  if (session.result) {
    lines.push('\n═══════════════════════════════════════════════════════');
    lines.push('✅ FINAL DECISION:\n');
    lines.push(session.result);
    lines.push('═══════════════════════════════════════════════════════');
  }

  return lines.join('\n');
}
