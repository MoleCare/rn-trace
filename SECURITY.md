# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Email **info@molecare.co.uk**, or open a private
[security advisory](https://github.com/MoleCare/rn-trace/security/advisories/new)
on this repository, with:

- what the issue is and where in the code it lives
- how to reproduce it
- what an attacker could do with it

You should get an acknowledgement within **3 working days**. We will tell you
when a fix is released and credit you in the release notes, unless you would
rather we did not.

## Supported versions

Security fixes go into the latest release.

## Scope

In scope:

- this package's code: how it formats and passes on the data the host app
  gives it, and anything it exposes to the host app
- dependency vulnerabilities that are reachable from this code

Out of scope here (but still worth telling us about at the same address): the
MoleCare apps and API.

## Data safety

The package writes only what the host app passes to it, to the sinks the app
chooses (by default the console, which ends up in the device log). It never
sends anything over the network. Never include personal or health data in a
trace, a bug report or a log you attach to one.
