# Release Process

This document describes how to release new versions of the `@mcampa/ai-context` packages.

## Prerequisites

- Clean git working directory (commit or stash all changes)
- Push access to the repository
- `NPM_TOKEN` secret configured in GitHub repository settings

## Quick Release

To release a new version, run:

```bash
pnpm release v0.0.2
```

Replace `v0.0.2` with your desired version number.

## What the Release Script Does

1. **Validates the version** - Ensures it's a valid semver format
2. **Checks version is valid** - New version must be greater than or equal to current (allows re-releases)
3. **Verifies package consistency** - All three packages must be on the same version
4. **Updates package.json files** - Updates version in all packages:
   - `packages/core/package.json`
   - `packages/mcp/package.json`
   - `packages/cli/package.json`
5. **Commits changes** - Creates commit: `chore: release vX.Y.Z`
6. **Creates git tag** - Tags the commit with `vX.Y.Z`
7. **Pushes to remote** - Pushes both the commit and tag

## Version Format

Versions must follow [Semantic Versioning](https://semver.org/):

```
major.minor.patch[-prerelease]
```

### Examples

| Version | Description |
|---------|-------------|
| `v1.0.0` | Stable release |
| `v1.2.3` | Patch release |
| `v2.0.0-beta.1` | Beta prerelease |
| `v2.0.0-alpha.1` | Alpha prerelease |
| `v1.0.0-rc.1` | Release candidate |

## GitHub Actions Workflow

Once the tag is pushed, the GitHub Actions workflow (`.github/workflows/release.yml`) automatically:

1. Builds all packages
2. Publishes to npm:
   - `@mcampa/ai-context-core`
   - `@mcampa/ai-context-mcp`
   - `@mcampa/ai-context-cli`

Monitor the workflow at: https://github.com/mcampa/ai-context/actions

## Troubleshooting

### "Git working directory is not clean"

Commit or stash your changes before releasing:

```bash
git add .
git commit -m "your message"
# or
git stash
```

### "New version must be higher than or equal to current version"

Check current versions:

```bash
cat packages/core/package.json | grep version
cat packages/mcp/package.json | grep version
cat packages/cli/package.json | grep version
```

### "Tag already exists"

The tag you're trying to create already exists. Choose a different version or delete the existing tag:

```bash
# Delete local tag
git tag -d v0.0.2

# Delete remote tag (use with caution!)
git push origin :refs/tags/v0.0.2
```

### "Packages are not on the same version"

All packages must have the same version. Manually update the out-of-sync package.json files, commit, and try again.

### Push failed

If the push fails but the commit and tag were created locally:

```bash
git push
git push origin v0.0.2
```

## Manual Release (Alternative)

If you need to release manually:

1. Update version in all `packages/*/package.json` files
2. Commit: `git commit -am "chore: release v0.0.2"`
3. Tag: `git tag v0.0.2`
4. Push: `git push && git push origin v0.0.2`

