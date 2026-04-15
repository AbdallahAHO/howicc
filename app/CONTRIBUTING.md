# Contributing to How I Claude Code

Thank you for considering contributing to How I Claude Code (howicc)! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/AbdallahAHO/howicc.git
   cd howicc/app
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Set up your development environment** following [SETUP.md](SETUP.md)

## Development Workflow

### Creating a Branch

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates

### Making Changes

1. **Write clean, readable code** following the existing style
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Run tests** before committing:
   ```bash
   pnpm test
   pnpm type-check
   ```

### Code Style

- **TypeScript**: Use strict type checking
- **Formatting**: Use Prettier defaults (2 spaces, single quotes)
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Comments**: Use JSDoc for public APIs

### Testing

We use Vitest for testing. Write tests for:

- **Schema validation** (`src/tests/schemas.test.ts`)
- **Helper functions** (`src/tests/pb.test.ts`)
- **Core logic** (`src/tests/ai-analysis.test.ts`)

Run tests:

```bash
# All tests
pnpm test

# Watch mode
pnpm test -- --watch

# With coverage
pnpm test -- --coverage

# UI mode
pnpm test:ui
```

### Committing Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```bash
git commit -m "feat(api): add batch upload endpoint"
git commit -m "fix(pb): resolve slug collision issue"
git commit -m "docs(readme): update installation steps"
```

### Submitting a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template** with:
   - Description of changes
   - Related issue number (if any)
   - Screenshots (for UI changes)
   - Testing steps

4. **Address review feedback** if needed

5. **Wait for approval** from a maintainer

## Project Structure

Understanding the codebase:

```
src/
├── components/         # Reusable Astro components
├── layouts/           # Page layouts
├── lib/               # Core libraries
│   ├── ai-analysis.ts    # AI processing & safety checks
│   ├── pb.ts             # PocketBase helpers
│   ├── process.ts        # Background job queue
│   └── schemas.ts        # Zod validation
├── pages/
│   ├── api/              # API endpoints
│   └── p/                # Public pages
├── styles/            # Global CSS
└── tests/             # Test files
```

## Areas for Contribution

### High Priority

- [ ] CLI tool for extracting Claude conversations
- [ ] Batch upload support
- [ ] Search and filtering UI
- [ ] User authentication integration
- [ ] Rate limiting for API endpoints

### Medium Priority

- [ ] Markdown export improvements
- [ ] Syntax highlighting themes
- [ ] Analytics and view counts
- [ ] Embed support
- [ ] RSS feed for public conversations

### Low Priority

- [ ] Dark mode toggle
- [ ] Conversation editing
- [ ] Tag management UI
- [ ] Admin dashboard
- [ ] i18n support

## Reporting Issues

When reporting bugs, please include:

1. **Environment**:
   - OS and version
   - Node.js version
   - PocketBase version
   - Browser (if UI bug)

2. **Steps to reproduce**

3. **Expected vs actual behavior**

4. **Error messages** (if any)

5. **Screenshots** (if applicable)

Use our [issue templates](.github/ISSUE_TEMPLATE/) when creating issues.

## Security Vulnerabilities

**Do not** report security vulnerabilities through public GitHub issues.

Instead, email contact@abdallahaho.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll respond within 48 hours.

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Be respectful and considerate
- Accept constructive feedback gracefully
- Focus on what's best for the community
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information

## Questions?

- **General questions**: Open a [Discussion](https://github.com/AbdallahAHO/howicc/discussions)
- **Bug reports**: Create an [Issue](https://github.com/AbdallahAHO/howicc/issues)
- **Feature requests**: Start a [Discussion](https://github.com/AbdallahAHO/howicc/discussions) first

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes (for significant contributions)
- GitHub contributors graph

Thank you for contributing to How I Claude Code! 🎉

**Maintainer**: [Abdallah Othman](https://abdallahaho.com) ([@AbdallahAHO](https://github.com/AbdallahAHO)) - contact@abdallahaho.com
