# CLI Distribution

The SynAI CLI is published on npm as one wrapper package and six platform
packages. `npm install -g synai` installs the matching standalone executable
for Windows, macOS, or Linux on x64 or ARM64. The executable includes Bun, so
users do not need to install Bun separately.

## npm Packages

| Package | Platform |
|---|---|
| `synai-cli-darwin-arm64` | macOS Apple Silicon |
| `synai-cli-darwin-x64` | macOS Intel |
| `synai-cli-linux-arm64` | Linux ARM64 |
| `synai-cli-linux-x64` | Linux x64 |
| `synai-cli-windows-arm64` | Windows ARM64 |
| `synai-cli-windows-x64` | Windows x64 |
| `synai` | Installer wrapper and command resolver |

Each platform package declares its supported `os` and `cpu`, so npm installs
only the binary that matches the current machine. The wrapper resolves that
package at launch and runs `synai` or `synai.exe` from it.

## Build and Publish

Run these commands from `packages/cli` with Bun, Node.js, and npm installed:

```sh
bun run typecheck
bun run build:platforms
bun run publish:npm:dry
```

`build:platforms` builds the shared and core workspace packages, creates the
CLI bundle, downloads OpenTUI native variants, and compiles all six platform
executables. The build script smoke-tests the executable for the current host.
The dry run prepares the generated wrapper package and lists the packages that
would be published.

Before publishing a release:

1. Set `packages/cli/package.json` to a version greater than the current npm
   version and add the release notes at the top of `CHANGELOG.md`.
2. Build all six packages and review the dry-run output.
3. Confirm `npm whoami` shows an account that owns `synai` and can publish the
   six `synai-cli-*` package names.
4. Run `bun run publish:npm` from `packages/cli`.

The platform packages publish first. The `synai` wrapper publishes after them
with matching `optionalDependencies`. The source package's direct `npm pack`
and `npm publish` commands are guarded; use the generated release packages.

## Windows Signing

The local build and npm publish scripts do not sign Windows executables. A
trusted code-signing certificate must be configured and the Windows binaries
signed before publishing when signed artifacts are required. Signing can
reduce operating-system warnings but cannot guarantee that antivirus software
will never flag a file.

## Resolver and Installation

The npm wrapper's `bin/synai.js` resolves the matching `synai-cli-*` package and
starts its executable. Installation has no lifecycle hooks: npm only unpacks
the platform binary, logo, README, and license. On Windows, npm creates the
command shim from the wrapper's `bin` field and the resolver starts the `.exe`.
