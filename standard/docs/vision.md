# The Operations Layer — Product Vision

*Christmas Air Internal Tools · working vision, July 2026*

## We set out to track installs. We built an operations layer.

A control tower that sits above every system of record and answers the one question
none of them can: **where is the work, and where is it stuck?**

---

## What it actually became

The install tracker stopped being about installs the moment we noticed the pattern
underneath it. Work is *done* in a dozen apps — ServiceTitan, the Orders app, the
Debrief form, the Service Dashboard. What was missing wasn't another place to do work.
It was a place to **see all of it at once**, as one operational status, and catch where
it jams.

> **The whole idea, in one sentence:** A workflow is stages → steps. Each step fills
> **automatically** from wherever the work happens — or it's a **manual gap** a person
> owns. Roll it up to status. Aggregate to find the bottleneck. *Nothing in that
> sentence says "install."*

That's why Partial, Warranty, and Service-Parts dropped in by seeding a template. The
engine doesn't care what the work is — it cares that it's a multi-step process, spread
across systems, with places it gets stuck.

## Why it matters

We run ~20 apps. Each is a system of record for one slice of the business. **Not one of
them sees the whole flow.** This is the only place that stitches them together and points
at the jam — and that's rare, because it means reading *across* silos, which a
single-purpose app never does. That cross-app vantage point is the moat.

## The discipline that keeps it valuable

| What it **is** | What it **is not** |
|---|---|
| A status + bottleneck layer across apps | A new system of record |
| One engine, any process | A replacement for the apps doing the work |
| Deep on a few high-pain flows | A shallow dashboard of everything |
| Honest about auto vs. manual | Trustworthy beyond its freshest sync |

The failure mode is seductive: track *everything*, become a shallow dashboard of twenty
processes, master of none. Two rules prevent it — **aggregate status, never own the
work**, and **go deep on flows that are both painful and fragmented**.

## The line: system of record vs. operations layer

Recalls make it concrete. The root-cause investigation belongs in the **Service
Dashboard** — that's the specialist system of record for *analyzing* recalls. What
belongs *here* is the cross-app view of a recall **flowing to resolution**, and where
it's stalled. The specialist app does the deep work; the control tower sees the flow.
Hold that line and the two never compete.

## It already works

Four install workflows are live (Full System, Partial, Warranty, Service-Parts), each
auto-fed from ServiceTitan, the Orders app, and the Debrief form — with a health
dashboard that surfaced the real bottleneck on day one: **not installs, but ~$154k of
finished jobs stuck in collections.** That's the whole thesis proving itself — the value
isn't tracking, it's seeing where the work stops moving.

## How it grows

Add workflows by **pain × fragmentation** — where the work is scattered across apps *and*
it hurts. If it lives in a spreadsheet, or in three apps at once, it's a candidate.
Installs were the perfect first case for exactly that reason. Recalls, memberships, AR,
onboarding — anything with a process no one can see end-to-end.

## Three consequences

1. **The name undersells it.** It's an operations tracker, not an install app — worth a
   rename when the moment's right.
2. **Sync freshness is the core dependency.** As an aggregator, it's only as trustworthy
   as its newest signal. Trust is the product.
3. **The health view is the point.** Workflows are the input; *seeing where work jams* is
   the output. Invest there.
