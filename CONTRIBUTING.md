# Contributing to AI Image Bot

Thanks for your interest in contributing! This document explains how to get set
up and what we expect from contributions.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file and fill in the required values:

   ```bash
   cp .env.example .env
   ```

   At minimum you need `DISCORD_TOKEN` and `CLIENT_ID`. `GOOGLE_API_KEY` is
   optional (image generation is disabled without it).

## Development Workflow

- `npm run dev` - Start the development server with hot reload.
- `npm run build` - Compile TypeScript to JavaScript.
- `npm start` - Run the production build.

Before opening a pull request, please make sure the full check suite passes
locally:

```bash
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npm test             # Jest test suite
```

These are the same checks that run in CI, so a green local run keeps the review
process fast.

## Coding Standards

- The project follows a **Clean Architecture** layout (`domain`, `application`,
  `infrastructure`, `presentation`, `shared`). Please keep changes within the
  appropriate layer.
- Code style is enforced with ESLint and Prettier. Run `npm run lint:fix` and
  `npm run format` to auto-fix most issues.
- A Husky pre-commit hook runs `lint-staged`, so staged files are linted and
  formatted automatically on commit.

## Tests

- New features and bug fixes should come with tests where practical.
- Tests live under `tests/` and run with Jest.
- Aim to keep the suite green; use `npm run test:coverage` to check coverage.

## Commit Messages

Please write clear, descriptive commit messages. Conventional Commit prefixes
(`feat:`, `fix:`, `docs:`, `chore:`, etc.) are appreciated but not required.

## Pull Requests

1. Create a topic branch off `main`.
2. Keep pull requests focused on a single change.
3. Ensure lint, type-check, and tests pass.
4. Describe what changed and why in the PR description.

## Reporting Issues

Found a bug or have a feature request? Please open an issue with as much detail
as possible, including reproduction steps for bugs.

Thanks for helping improve AI Image Bot!
