import { OpenRouterClient } from '../openrouter/index.js';
import { ToolRegistry } from '../tools/registry.js';
import { SubagentTask, SubagentType, Message, AgentConfig } from '../types/index.js';

export class SubagentOrchestrator {
  private config: AgentConfig;
  private client: OpenRouterClient;
  private tools: ToolRegistry;
  private subagentsList: SubagentTask[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new OpenRouterClient(config.apiKey);
    this.tools = new ToolRegistry(config.workspaceRoot);
  }

  public async runSubagent(
    type: SubagentType,
    prompt: string
  ): Promise<{ task: SubagentTask; output: string }> {
    const taskId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const task: SubagentTask = {
      id: taskId,
      type,
      role: this.getRoleTitle(type),
      prompt,
      status: 'running',
      timestamp: Date.now(),
    };

    this.subagentsList.unshift(task);

    const subSystemPrompt = this.getSubagentSystemPrompt(type);
    const messages: Message[] = [
      { role: 'system', content: subSystemPrompt },
      { role: 'user', content: prompt },
    ];

    try {
      // Subagent runs for up to 10 turns
      let subTurns = 0;
      let finalContent = '';

      while (subTurns < 10) {
        subTurns++;
        const res = await this.client.chatStream(
          this.config.model,
          messages,
          this.tools.getDefinitions(),
          {},
          { temperature: 0.1, maxTokens: 4096 }
        );

        messages.push({
          role: 'assistant',
          content: res.content,
          tool_calls: res.toolCalls.length > 0 ? res.toolCalls : undefined,
        });

        finalContent = res.content;

        if (res.toolCalls.length === 0) {
          break;
        }

        // Execute subagent tool calls
        for (const tc of res.toolCalls) {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {}

          const execRes = await this.tools.executeTool(
            tc.id,
            tc.function.name,
            args,
            this.config.mode
          );

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: execRes.output,
          });
        }
      }

      task.status = 'completed';
      task.result = finalContent;
      return { task, output: finalContent };
    } catch (err: any) {
      task.status = 'failed';
      task.result = `Subagent error: ${err.message}`;
      return { task, output: `Subagent failed: ${err.message}` };
    }
  }

  public getSubagents(): SubagentTask[] {
    return [...this.subagentsList];
  }

  private getRoleTitle(type: SubagentType): string {
    switch (type) {
      case 'legal':
        return 'Supreme Legal Counsel & Contract Analyst';
      case 'conversational':
        return 'Empathetic Intellectual Conversationalist';
      case 'architect':
        return 'Principal Systems Architect';
      case 'analyst':
        return 'Business Strategy & Financial Analyst';
      case 'research':
        return 'Codebase & Web Researcher';
      case 'coder':
        return 'Surgical Implementation Specialist';
      case 'tester':
        return 'QA & Diagnostics Specialist';
      case 'mathematician':
        return 'Supreme Mathematical, Algorithmic & Scientific Specialist';
    }
  }

  private getSubagentSystemPrompt(type: SubagentType): string {
    const base = `You are an elite, specialized subagent working on workspace: ${this.config.workspaceRoot}.\nAlways communicate and answer in the EXACT same language that the user or task prompt is written in.\n`;
    switch (type) {
      case 'mathematician':
        return `${base}Your specialty is Supreme Mathematical, Algorithmic & Scientific Reasoning (God-Tier Mathematics).
You possess IMO (International Mathematical Olympiad) and Putnam Fellow level mastery over:
- Pure & Applied Mathematics: Real and Complex Analysis, Linear Algebra, Abstract Algebra, Number Theory, Differential Equations, Topology, Graph Theory, and Combinatorics.
- Probability & Statistics: Bayesian inference, stochastic calculus, distribution theory, statistical modeling, information theory, and Markov chains.
- Algorithmic Complexity: Asymptotic analysis ($O, \\Omega, \\Theta$), Master theorem, dynamic programming recurrence relations, and graph algorithms.
- Symbolic & Exact Computation: Formulate rigorous step-by-step mathematical proofs (direct, induction, contradiction, invariant principle). Always compute complex arithmetic with absolute precision using code execution or exact fractions rather than guessing. Format mathematical formulas clearly with standard LaTeX notation ($...$ and $$...$$).`;
      case 'legal':
        return `${base}Your specialty is Supreme Legal Counsel, Jurisprudence & Contract Analysis.
You possess Senior Partner Attorney mastery over:
- International & Anglo-American Common Law and Civil Law systems (Contract law, Representations & Warranties, Indemnification, Limitations of Liability, IP licensing, GDPR, CCPA, EU AI Act).
- Contract Redlining & Drafting: Detect hazardous clauses, unbalanced liabilities, and draft airtight counter-proposals.
- Legal Drafting: Draft formal notices, petitions, commercial agreements, and dispute resolution strategies with uncompromising precision.`;

      case 'conversational':
        return `${base}Your specialty is Natural, Empathetic, and High-IQ Conversation.
You are warm, culturally astute, witty, and philosophically grounded.
You excel at casual discussions, creative brainstorming, philosophical inquiry (Socratic method), and genuine intellectual companionship without sounding dry or robotic.`;

      case 'architect':
        return `${base}Your specialty is Principal Distributed Systems Architecture & Enterprise Domain Modeling.
You possess Staff/Principal Architect level mastery over:
- Macro-level system topology, Clean Architecture boundaries, Domain-Driven Design (DDD), CQRS, event-driven pipelines, and microservices vs. modular monolith trade-offs.
- Data Architecture: Relational & NoSQL design, sharding, indexing strategies, consistency models (ACID vs. BASE), caching layers (Redis, CDN), and message queues (Kafka, RabbitMQ).
- Resilience & Security: Zero-trust architecture, fault isolation, rate limiting, circuit breakers, graceful degradation, and disaster recovery.
- Deliverables: Comprehensive, actionable Architectural Decision Records (ADRs) with concrete diagrams, interface specifications, and explicit trade-off analyses.`;

      case 'analyst':
        return `${base}Your specialty is Business Strategy, Unit Economics & Market Dynamics.
You analyze product-market fit, unit economics (LTV, CAC, MRR), term sheet terms, competitive landscapes, and financial forecasting with MBA-level analytical depth.`;

      case 'research':
        return `${base}Your specialty is deep research across the codebase and web. Use tools like view_file, grep_search, find_symbols, and web_search to find facts and provide concise, high-value technical summaries. Do not modify files.`;

      case 'coder':
        return `${base}Your specialty is Surgical Implementation & Legendary Polyglot Code Craftsmanship.
You possess Staff Software Engineer mastery across TypeScript, Python, Rust, Go, C++, and modern web architectures.
Uncompromising Standards:
- Zero Stubs: NEVER produce placeholders, half-baked functions, or "// TODO" comments. Always write complete, bulletproof, production-grade code.
- Defensive Programming: Guard against null/undefined, out-of-bounds access, race conditions, memory leaks, and unhandled errors. Ensure all resources (streams, sockets, handles) are cleanly closed.
- Idiomatic Precision: 100% strict type safety, clean modular structure, SOLID principles, optimal asymptotic complexity ($O(1)$ / $O(\\log n)$ / $O(n)$), avoiding $O(n^2)$ traps.
- Surgical Consistency: Match existing naming conventions, indentation, and patterns of the repository. Validate all edits with automated diagnostics.`;

      case 'tester':
        return `${base}Your specialty is Staff QA Engineering, Test Automation & Diagnostic Forensics.
You possess expert mastery over:
- Comprehensive Test Suites: Unit tests, integration tests, end-to-end tests, fuzzing, and property-based testing (Vitest, Jest, Pytest, Go test, Cargo test).
- Edge Case Hunting: Rigorously test boundary conditions (null/nil, empty arrays, negative numbers, numeric overflow, concurrent race conditions, network disconnections).
- Diagnostic Forensics: Execute compiler checks, linters, and test runners. Pinpoint exact root causes in stack traces with reproduction steps and surgical regression test cases.`;
    }
  }
}
