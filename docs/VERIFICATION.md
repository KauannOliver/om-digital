# Snapshot verification

Checks recorded in the isolated source copy on 2026-10-28. These results are not a production certification.

| Directory | Command | Result |
| --- | --- | --- |
| `.` | `npm ci --ignore-scripts --no-audit --no-fund` | Passed |
| `.` | `npm run build` | Passed |

Python application files passed syntax parsing. This does not execute imports, launch the desktop UI, contact a portal or validate an external integration.

## Publication boundaries

- Operational sources remained read-only; only isolated copies were prepared.
- No corporate service, real-record import, live notification or production database was invoked.
- No deployment command, deploy workflow or new hosting integration is part of this update. Included Vercel configurations disable Git-driven deployments.
- New source imports exclude local environments, databases, generated outputs and operational documents.
- Existing Git history is preserved. Historical public names or assets may remain in old commits; current snapshots use neutral public presentation.

## Production npm dependency audit — om-digital

`npm audit --omit=dev --json` reported 1 critical, 3 high, 5 moderate, 0 low findings in the installed dependency tree on 2026-10-28. Counts include transitive packages and do not establish exploitability in this application.

| Package | Severity | Direct dependency |
| --- | --- | --- |
| `@remix-run/router` | moderate | No |
| `body-parser` | high | No |
| `express` | moderate | Yes |
| `mysql2` | high | Yes |
| `path-to-regexp` | high | No |
| `proxy-addr` | critical | No |
| `qs` | moderate | No |
| `react-router` | moderate | No |
| `react-router-dom` | moderate | Yes |

These advisories remain a maintenance item. This documentation/publication task did not perform dependency upgrades or validate a production security posture.
