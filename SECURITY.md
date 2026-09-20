# Security Policy

## 🔒 Security Statement

SynAI takes security seriously. We appreciate the security research community's efforts in identifying vulnerabilities and helping us maintain a secure product.

## 📋 Supported Versions

We provide security updates for the following versions:

| Version | Supported              |
| ------- | ---------------------- |
| 1.2.x   | ✅ Yes                 |
| 1.1.x   | ✅ Yes                 |
| 1.0.x   | ⚠️ Critical fixes only |
| < 1.0   | ❌ No                  |

## 🐛 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### Preferred Method: Security Advisory

1. Go to the [Security Advisories](https://github.com/realutj/synai/security/advisories) page
2. Click "Report a vulnerability"
3. Fill out the form with details

### Alternative Method: Email

Send an email to **security@synai.dev** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Include

Please provide as much information as possible:

```markdown
**Vulnerability Type:** [e.g., XSS, SQL Injection, RCE]

**Affected Component:** [e.g., CLI, Web Dashboard, Core Agent]

**Affected Versions:** [e.g., 1.2.0 - 1.2.3]

**Description:**
[Detailed description of the vulnerability]

**Steps to Reproduce:**

1. Step one
2. Step two
3. Step three

**Impact:**
[What an attacker could do with this vulnerability]

**Proof of Concept:**
`code or screenshots`

**Suggested Fix:**
[If you have ideas on how to fix it]

**Environment:**

- OS: [e.g., Ubuntu 22.04]
- Node.js: [e.g., v20.10.0]
- SynAI Version: [e.g., 1.2.3]
```

## 🛡️ Security Measures

### Code Security

- **Dependency Scanning** — Automated vulnerability scanning via Dependabot
- **Static Analysis** — CodeQL security analysis on all PRs
- **Type Safety** — Strict TypeScript with full type checking
- **Input Validation** — All user inputs are sanitized
- **Secure Defaults** — Safe configuration out of the box

### API Key Security

- API keys are **never logged** or sent to external services
- Keys are stored with OS-level encryption when possible
- Environment variables are the recommended storage method
- `.env` files are git-ignored by default

### Command Execution Safety

- **Approval Modes** — Interactive confirmation before executing commands
- **Dry Run Mode** — Preview changes without execution
- **Sandboxing** — Limited file system access when possible
- **Path Validation** — All file paths are validated and sanitized

### Web Dashboard Security

- **CORS Protection** — Strict origin validation
- **CSP Headers** — Content Security Policy enabled
- **XSS Prevention** — All user content is escaped
- **CSRF Protection** — Token-based request verification

## 📅 Disclosure Timeline

When you report a vulnerability:

1. **Acknowledgment** — Within 48 hours
2. **Initial Assessment** — Within 5 business days
3. **Fix Development** — Varies by severity
4. **Coordinated Disclosure** — Typically 90 days after report

### Severity Levels

| Severity     | Description                       | Response Time |
| ------------ | --------------------------------- | ------------- |
| **Critical** | RCE, arbitrary code execution     | 24-48 hours   |
| **High**     | Data breach, privilege escalation | 3-7 days      |
| **Medium**   | XSS, CSRF, information disclosure | 14-30 days    |
| **Low**      | Minor information leaks           | 30-90 days    |

## 🏆 Recognition

We believe in recognizing security researchers who help us:

- **Public Acknowledgment** — Listed in SECURITY.md (with permission)
- **CVE Credit** — Credited in CVE reports
- **Hall of Fame** — Featured on our website

### Security Researchers Hall of Fame

_Thank you to these researchers who have helped secure SynAI:_

- _(No reports yet — be the first!)_

## 🚫 Out of Scope

The following are **not** considered security vulnerabilities:

- Denial of Service via excessive requests (rate limiting is user's responsibility)
- Social engineering attacks
- Physical access attacks
- Issues in dependencies we don't control
- Theoretical vulnerabilities without proof of concept
- Issues requiring physical access to a user's device
- Issues in outdated/unsupported versions

## 📚 Security Best Practices

### For Users

1. **Keep Updated** — Always use the latest version
2. **Secure API Keys** — Use environment variables, never commit keys
3. **Review Permissions** — Understand what SynAI can access
4. **Use Confirmation Mode** — Default `confirm` mode prevents unwanted changes
5. **Audit Logs** — Review `.synai/logs` regularly

### For Developers

1. **Validate Inputs** — Never trust user input
2. **Sanitize Outputs** — Escape all dynamic content
3. **Minimize Permissions** — Request only what's needed
4. **Audit Dependencies** — Run `npm audit` regularly
5. **Follow Guidelines** — See [CONTRIBUTING.md](CONTRIBUTING.md)

## 🔐 Encryption & Storage

### Local Storage

- Configuration stored in `~/.synai/config.json`
- API keys encrypted with OS keychain when available
- Session data is ephemeral and not persisted

### Network Communication

- All API calls use HTTPS
- TLS 1.2+ required
- Certificate pinning for critical endpoints

### Data Retention

- Logs are rotated automatically
- Sensitive data is redacted from logs
- No telemetry without explicit consent

## 📞 Contact

- **Security Issues:** synai2026@hotmail.com
- **General Questions:** synai2026@hotmail.com
- **GitHub Security:** [Security Advisories](https://github.com/realutj/synai/security/advisories)

## 📖 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Advisories](https://www.npmjs.com/advisories)

---

**Last Updated:** January 2026

Thank you for helping keep SynAI and its users safe! 🛡️
