# Coding Agent Instructions

This repository is a reusable learning-template platform. Academy instances
should be updated from the template without overwriting academy-owned content.

## Update An Academy Instance

When asked to update an academy instance from this template, use the sync script:

```bash
/path/to/learn-template/scripts/update-template.sh --target /path/to/academy-instance
```

If running from inside an instance that has this script copied locally, pass the
template checkout explicitly:

```bash
pnpm update:template -- --source /path/to/learn-template
```

Before updating:

- Confirm the target path is the academy instance, not the template checkout.
- Require a clean target git worktree. The script enforces this for git repos.
- Use `--dry-run` first when the target has valuable local customization.

Preserve academy-owned files unless the user explicitly asks for a migration:

- `content/`
- `presentations/`
- `academy.config.ts`
- `.env*`
- `docker-compose.yml`
- local dependency/build output

After updating, review the diff and run these in the target instance when
feasible:

```bash
pnpm install
pnpm validate
pnpm test
pnpm lint
pnpm build
```

## Content Work

- Do not modify `src/`, `__tests__/`, root config, or CI files unless asked to
  change the platform.
- Author tutorial specs in `content/tutorials/`.
- Author rendered lessons in `content/module-N/`.
- Use the staged prompts in `prompts/`.
- Mark uncertain factual claims with `VerifyClaim`.

See `CLAUDE.md` for the full content-authoring guide.
