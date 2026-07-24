[![MotionScore](https://images.motion.dev/og/fresh/v1/score/home-25grdau0grse0.png)](https://score.motion.dev)

# MotionScore Guard

Audit animation performance on every pull request. MotionScore loads your pages in a real browser on the runner, grades them S to F (compositor vs paint vs layout cost, scroll animations, layout thrashing, GPU pressure), and comments the results on the PR.

The grades comment is **free for any repository**: no token, no account. Adding a [MotionScore](https://score.motion.dev) token and a `threshold` upgrades it into a gate that fails the build when a page grades below your bar.

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
      - uses: motiondivision/motionscore-guard@v1
        with:
          url: ${{ github.event.deployment_status.environment_url }}
          pages: |
            /
            /pricing
```

Vercel, Cloudflare Pages and Netlify all emit the `deployment_status` event with the preview URL, so the above works unchanged with any of them. Open a pull request and Guard appears in the PR's checks with a grades comment that updates on every push.

## Add the gate

With a paid [MotionScore plan](https://score.motion.dev/pricing), add your API token as a repository secret named `MOTIONSCORE_TOKEN` (**Settings → Secrets and variables → Actions**, or `gh secret set MOTIONSCORE_TOKEN`) and extend the `with:` block:

```yaml
          threshold: A
          token: ${{ secrets.MOTIONSCORE_TOKEN }}
```

Now the check fails whenever a page grades below `threshold`. Full step-by-step guide: [score.motion.dev/docs/guard](https://score.motion.dev/docs/guard).

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `url` | required | Base URL to audit |
| `pages` | `/` | Newline-separated paths, relative to `url` |
| `threshold` | none | Fail if any page grades worse than this tier (S/A/B/C/D/F). Requires a paid [MotionScore plan](https://score.motion.dev/pricing) and `token`. Empty = report-only comment |
| `token` | none | MotionScore API token, from your [Motion dashboard](https://motion.dev/dashboard/tokens), stored as the `MOTIONSCORE_TOKEN` repository secret |
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
