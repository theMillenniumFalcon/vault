# Changesets

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management.

## Workflow

1. After making changes, create a changeset:
   ```bash
   bun run changeset
   ```

2. When ready to release, bump versions and changelogs:
   ```bash
   bun run version-packages
   ```

3. Publish to npm (requires npm login + 2FA OTP):
   ```bash
   cd packages/vault-memory
   npm publish --access public --otp=YOUR_OTP_CODE
   ```

   Or from root after versioning:
   ```bash
   bun run release
   ```
