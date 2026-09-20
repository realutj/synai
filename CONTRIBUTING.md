# Contributing to SynAI

First off, thank you for considering contributing to SynAI! It's people like you that make SynAI such a great tool.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Style Guides](#style-guides)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## 📜 Code of Conduct

This project and everyone participating in it is governed by the [SynAI Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0 or yarn ≥ 1.22.0
- Git

### Setting Up Your Development Environment

1. **Fork the Repository**

   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/synai.git
   cd synai
   ```

3. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/realutj/synai.git
   ```

4. **Install Dependencies**

   ```bash
   npm install
   ```

5. **Build All Packages**

   ```bash
   npm run build
   ```

6. **Run Tests**
   ```bash
   npm test
   ```

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear descriptive title**
- **Detailed steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots** (if applicable)
- **Environment details** (OS, Node version, SynAI version)

**Example:**

```markdown
**Bug:** CLI crashes when running `/undo` command

**To Reproduce:**

1. Launch `synai`
2. Make a file edit
3. Run `/undo`
4. CLI crashes with error: [paste error]

**Expected:** Should revert the last change

**Environment:**

- OS: macOS 14.2
- Node: v20.10.0
- SynAI: v1.2.3
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear descriptive title**
- **Provide detailed description** of the proposed feature
- **Explain why this would be useful** to most users
- **List any alternative solutions** you've considered

### Your First Code Contribution

Unsure where to begin? Look for issues tagged with:

- `good first issue` — Good for newcomers
- `help wanted` — Need assistance
- `documentation` — Docs improvements

## 💻 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:

- `feature/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions/fixes

### 2. Make Your Changes

- Write clean, readable code
- Follow the style guide
- Add tests for new features
- Update documentation as needed

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific package tests
npm test --workspace=packages/core

# Lint code
npm run lint

# Format code
npm run format
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature"
```

See [Commit Guidelines](#commit-guidelines) below.

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template
4. Submit the pull request

## 📝 Style Guides

### TypeScript Style Guide

- Use **TypeScript** for all new code
- Enable strict type checking
- Prefer `interface` over `type` for object shapes
- Use `const` for immutable values
- Use descriptive variable names

**Example:**

```typescript
// Good
interface UserConfig {
  apiKey: string;
  theme: Theme;
  approvalMode: ApprovalMode;
}

const getUserConfig = async (userId: string): Promise<UserConfig> => {
  // implementation
};

// Avoid
type cfg = {
  k: string;
  t: any;
  m: string;
};
```

### Code Formatting

- **Indentation:** 2 spaces (no tabs)
- **Line Length:** Max 100 characters
- **Quotes:** Single quotes for strings
- **Semicolons:** Always use
- **Trailing Commas:** Use in multi-line structures

We use **Prettier** for automatic formatting:

```bash
npm run format
```

### Documentation Style

- Use **Markdown** for documentation
- Write clear, concise descriptions
- Include code examples where applicable
- Use proper heading hierarchy (`#`, `##`, `###`)

## 📋 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation changes
- `style` — Code style changes (formatting, etc.)
- `refactor` — Code refactoring
- `test` — Test additions or fixes
- `chore` — Build process or auxiliary tool changes
- `perf` — Performance improvements

### Examples

```bash
feat(cli): add interactive theme selector

Add new /theme command that shows an interactive picker
for selecting CLI color themes.

Closes #123

fix(core): resolve memory leak in agent loop

The agent loop was not properly cleaning up event listeners,
causing memory to grow over time.

Fixes #456

docs: update installation instructions

Add instructions for Windows users and clarify Node version
requirements.
```

### Scope

The scope should be the name of the package affected:

- `core`
- `cli`
- `web`
- `shared`

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No linting errors
- [ ] Branch is up to date with `main`

### PR Title Format

Use the same format as commit messages:

```
feat(cli): add new feature
fix(core): resolve bug
```

### PR Description Template

```markdown
## Description

Brief description of changes

## Motivation and Context

Why is this change required? What problem does it solve?

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?

Describe the tests you ran

## Screenshots (if applicable)

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added
- [ ] Documentation updated
- [ ] Tests added
- [ ] All tests pass
```

### Review Process

1. **Automated Checks** — CI/CD runs tests and linting
2. **Code Review** — Maintainers review your code
3. **Feedback** — Address any requested changes
4. **Approval** — Once approved, PR will be merged

### After Merge

- Delete your feature branch
- Pull latest changes from upstream
- Continue contributing!

## 🧪 Testing Guidelines

### Writing Tests

- Place tests next to the code they test
- Use descriptive test names
- Test edge cases
- Aim for high coverage (>80%)

**Example:**

```typescript
// packages/core/src/agent/index.test.ts

describe("Agent", () => {
  describe("executeCommand", () => {
    it("should execute shell commands successfully", async () => {
      const result = await agent.executeCommand('echo "test"');
      expect(result.output).toBe("test");
    });

    it("should handle command errors gracefully", async () => {
      const result = await agent.executeCommand("invalid_command");
      expect(result.error).toBeDefined();
    });
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Specific package
npm test --workspace=packages/core
```

## 📚 Additional Resources

- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## ❓ Questions?

- Open a [GitHub Discussion](https://github.com/realutj/synai/discussions)
- Email us at synai2026@hotmail.com

---

Thank you for contributing to SynAI! 🎉
