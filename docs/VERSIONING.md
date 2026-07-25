# Versioning

Reality Splitter uses `package.json` as the single source of truth for product versions.

`public/manifest.json` is synchronized from `package.json` before every production build by `npm run sync:version`.

## Version Levels

Use a lightweight SemVer policy:

- `PATCH` for bug fixes, copy changes, UI polish, prompt improvements that keep the same output contract, and Chrome packaging fixes.
- `MINOR` for user-facing workflow additions, new analysis modes, new settings, new storage fields, or compatible schema additions.
- `MAJOR` for breaking storage migrations, incompatible API/provider behavior, removed modes, or changes that require users to reset settings.

Current pre-1.0 rule: treat `0.x` minor bumps as meaningful product milestones and patch bumps as safe iteration releases.

## Release Checklist

Before sharing a build:

1. Update `package.json` version.
2. Add a `CHANGELOG.md` entry with product intent, user-facing changes, and verification.
3. Run `npm run build`.
4. Confirm `public/manifest.json` and `dist/manifest.json` match `package.json`.
5. Reload the unpacked extension in Chrome and smoke-test the changed workflow.
6. Confirm `git status` contains only the intended release changes.
7. Commit the verified source with the version in the commit message.
8. Create a local annotated tag such as `v0.1.6` on that exact commit.

Never reuse a released version number for different source code. Any change after a
tagged release requires at least a patch version bump.

## Version Ownership

Do not manually edit `public/manifest.json` version unless you are also updating `package.json`.

The build script exists to prevent package and extension versions from drifting apart.

Git commits and annotated tags are the recovery boundary. `CHANGELOG.md` explains a
version, but it does not replace a recoverable source snapshot.

`0.1.6` is the first traceable quality baseline for the repository.
