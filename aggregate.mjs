/* Aggregates per-page --summary JSON files written by the audit step into:
 * - a sticky PR comment body (comment.md, rendered by the github-script step)
 * - the job's step summary
 * - action outputs (grade, pass)
 * Run as: node aggregate.mjs <dir> with BASE_URL and THRESHOLD in the env. */
import { readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
const baseUrl = (process.env.BASE_URL ?? "").replace(/\/$/, "")
const threshold = process.env.THRESHOLD || null

const TIER_ORDER = ["S", "A", "B", "C", "D", "F"]
const SEVERITY_RANK = { critical: 0, high: 1, low: 2 }
const MARKER = "<!-- motionscore-guard -->"

const pages = existsSync(join(dir, "pages.txt"))
  ? readFileSync(join(dir, "pages.txt"), "utf8").split("\n").filter(Boolean)
  : []

const results = pages.map((page, index) => {
  const file = join(dir, `summary-${index + 1}.json`)
  if (!existsSync(file)) return { page, failed: true }
  try {
    return { page, failed: false, summary: JSON.parse(readFileSync(file, "utf8")) }
  } catch {
    return { page, failed: true }
  }
})

const graded = results.filter((r) => !r.failed)
const worst = graded.reduce(
  (acc, r) => (TIER_ORDER.indexOf(r.summary.overallTier) > TIER_ORDER.indexOf(acc) ? r.summary.overallTier : acc),
  "S",
)
const anyBelow = graded.some((r) => r.summary.pass === false)
const anyFailed = results.some((r) => r.failed)
const pass = !anyBelow && !anyFailed && graded.length > 0

const rows = results.map((r) => {
  if (r.failed) return `| \`${r.page}\` | – | – | – | audit failed |`
  const s = r.summary
  const status =
    s.pass === false ? `✗ below ${threshold}` : threshold ? "✓" : ""
  const link = s.resultsUrl ? ` ([report](${s.resultsUrl}))` : ""
  return `| \`${r.page}\` | **${s.overallTier}** (${s.overallScore})${link} | ${s.desktop.tier} | ${s.mobile.tier} | ${status} |`
})

const findings = graded
  .flatMap((r) => (r.summary.findings ?? []).map((f) => ({ ...f, page: r.page })))
  .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
  .slice(0, 3)

const GUARD_DOCS = "https://score.motion.dev/docs/guard?utm_source=github&utm_medium=guard-comment"

const verdict = threshold
  ? pass
    ? `threshold **${threshold}**: **pass**`
    : `threshold **${threshold}**: **fail**`
  : `report only · [add the gate →](${GUARD_DOCS})`

const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
const badge = host
  ? `[![MotionScore](https://api.motion.dev/score/badge?url=${encodeURIComponent(host)})](https://score.motion.dev/site/${host})`
  : ""

const lines = [
  MARKER,
  "### MotionScore Guard",
  ...(badge ? ["", badge] : []),
  "",
  `${baseUrl} · ${verdict}`,
  "",
  "| Page | Grade | Desktop | Mobile | |",
  "| --- | --- | --- | --- | --- |",
  ...rows,
]

if (findings.length > 0) {
  lines.push("", ...findings.map((f) => `- **${f.severity.toUpperCase()}** ${f.title} (\`${f.page}\`, ${f.viewport})`))
}

lines.push(
  "",
  `<sub>Stop shipping animation performance regressions with **[MotionScore Guard](${GUARD_DOCS})**. Run your free audits at [score.motion.dev](https://score.motion.dev?utm_source=github&utm_medium=guard-comment)</sub>`,
  "",
)

const body = lines.join("\n")
writeFileSync(join(dir, "comment.md"), body)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${body.replace(MARKER, "")}\n`)
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `grade=${graded.length > 0 ? worst : "none"}\n`)
  appendFileSync(process.env.GITHUB_OUTPUT, `pass=${pass}\n`)
}
