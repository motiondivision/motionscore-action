[![MotionScore](https://images.motion.dev/og/fresh/v1/score/home-25grdau0grse0.png)](https://score.motion.dev)

# MotionScore Guard

Audit animation performance on every pull request. MotionScore loads your pages in a real browser on the runner, grades them S to F (compositor vs paint vs layout cost, scroll animations, layout thrashing, GPU pressure), comments the results on the PR, and optionally fails the build below a grade threshold.

Create a workflow file in your repository, for example `.github/workflows/motionscore.yml`:

```yaml
name: MotionScore Guard
on: deployment_status
jobs:
  guard:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: motiondivision/motionscore-action@v1
        with:
          url: ${{ github.event.deployment_status.environment_url }}
          pages: |
            /
            /pricing
          threshold: A
          token: ${{ secrets.MOTIONSCORE_TOKEN }}
```

Vercel, Cloudflare Pages and Netlify all emit the `deployment_status` event with the preview URL, so the above works unchanged with any of them.

## No preview deployments?

Build and serve a production build on the runner instead. With no deployment to wait for, trigger on the pull request itself:

```yaml
name: MotionScore Guard
on: pull_request
jobs:
  guard:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: motiondivision/motionscore-action@v1
        with:
          serve: npm ci && npm run build && npx serve dist -l 4173
          url: http://localhost:4173
          threshold: A
          token: ${{ secrets.MOTIONSCORE_TOKEN }}
```

Always audit a production build. A dev server (HMR, unminified code) will not grade like the site you ship.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `url` | required | Base URL to audit |
| `pages` | `/` | Newline-separated paths, relative to `url` |
| `threshold` | none | Fail if any page grades worse than this tier (S/A/B/C/D/F). Requires a paid [MotionScore plan](https://score.motion.dev/pricing) and `token`. Empty = report-only comment |
| `token` | none | MotionScore API token, from your [Motion dashboard](https://motion.dev/dashboard/tokens). Add it as a repository secret (Settings → Secrets and variables → Actions, or `gh secret set MOTIONSCORE_TOKEN`) |
| `serve` | none | Command to build and serve the site before auditing |
| `upload` | `false` | Upload reports to score.motion.dev (consumes monthly audit slots, adds report links to the comment) |
| `comment` | `true` | Post or update a sticky PR comment |
| `cli-version` | pinned | `motionscore` CLI version to run |

## Outputs

- `grade`: worst overall tier across the audited pages
- `pass`: `"true"` when every page met the threshold (or no threshold was set)

## Metering and cost

The browser runs on your GitHub runner, so audits cost you only runner minutes (roughly 1 to 3 per page; Chrome is cached between runs). Guard runs with `--threshold` are unmetered and consume none of your monthly audit allowance; only `upload: true` consumes slots.

## Exit behaviour

The PR comment posts before the gate fires. The job fails with exit `1` when a page grades below `threshold`, and exit `2` when an audit could not run. If api.motion.dev is unreachable, the run warns and continues rather than failing your build.

## Development

This repository is a mirror. The action is developed in the [motion monorepo](https://github.com/motiondivision) alongside the [`motionscore` CLI](https://www.npmjs.com/package/motionscore) that does the actual auditing.
