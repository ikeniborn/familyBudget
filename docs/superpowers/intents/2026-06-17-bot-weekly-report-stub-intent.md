# Intent: Resolve dormant weekly-report job (registered cron, stub body)

**Date:** 2026-06-17
**Status:** approved

## Objective
`bot/jobs/weekly_report.py:25` `send_weekly_reports` is documented
"NOT IMPLEMENTED" — it logs and exits without sending anything, yet the
APScheduler cron is still registered to fire every Sunday 20:00. Users who
enabled notifications expect a weekly report and receive nothing; the live job
is silent dead weight and the report-building helpers below it are unreachable.
Resolve the inconsistency now so scheduled behavior matches reality.

## Desired Outcomes
- The Sunday 20:00 schedule has a definitive behavior: either it sends a real
  weekly report, or the dead cron registration is removed.
- No scheduled job exists whose body is a deliberate no-op.
- Whatever is chosen, a user with notifications enabled gets a result that
  matches documentation (report delivered, or feature explicitly absent).

## Health Metrics
- Other bot scheduled jobs and command handlers keep working.
- Bot service startup and APScheduler registration stay clean (no missing-job errors).
- Backend notification API contract unchanged unless deliberately extended.

## Strategic Context
- Interacts with: `bot/jobs/weekly_report.py`, the bot scheduler registration,
  `NotificationService` (currently initialized but untriggered), backend
  notifications/push (see [[realtime#In-App Notifications]], [[api#Notifications & Push Endpoints]]).
- Root blocker noted in source: weekly reports need **persistent token storage
  or a service account** — bot sessions are in-memory only today.
- Two candidate directions (decide in brainstorm): (a) implement using
  service-account/internal auth to backend; (b) remove the cron + unreachable
  helpers until token storage exists.
- Priority trade-off: **trust** — no silent dead schedules; honest behavior.

## Constraints
### Steering (behavioral guidance)
- Do not leave a registered job with a stub body — pick a real behavior.
- If implementing, reuse internal-auth (`X-Api-Key`) path the bot already uses
  for internal calls rather than inventing per-user token persistence.
### Hard (architectural enforcement)
- Bot → backend over HTTP only.
- Do not add a new persistent user-token store without explicit approval.

## Autonomy Zones
- Full autonomy (reversible, low risk): adding tests, logging clarity.
- Guarded (log + confidence threshold): removing the unreachable helper code if direction = remove.
- Proposal-first (needs approval): choosing implement-vs-remove; any new auth/storage mechanism.
- No autonomy (human only): introducing persistent per-user Telegram token storage.

## Stop Rules
- Halt if: implementing requires storing user credentials/tokens not currently
  available → escalate (this is the documented blocker).
- Escalate if: the chosen direction changes the backend auth model.
- Done when: the Sunday 20:00 schedule either delivers an observable weekly
  report in a real run, or the cron + dead helpers are gone and startup is clean
  — with no remaining no-op scheduled job.
