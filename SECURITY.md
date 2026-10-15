# Security policy

[Українською](SECURITY.uk.md)

## Supported versions

Only the latest release gets security fixes. Teul is fully offline: it has no servers, accounts or network features, so most issues concern the device itself — the sealed saves, the encrypted backups and the integrity of the event log.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's private vulnerability reporting: the repository's **Security** tab → **Report a vulnerability**. Include what is affected (platform and version), how to reproduce it and what an attacker could do with it.

You will get an answer within a week. Once the issue is confirmed, a fix is prepared and released, and you are credited in the release notes unless you prefer otherwise. Please give us a reasonable time to release a fix before you disclose the issue publicly.

## What is in scope

- Reading or changing a sealed save or an encrypted backup without its key or password.
- Editing the event log so that the change is accepted as genuine.
- Code execution through a crafted save, backup or content file.
- Any network traffic from the game (it should make none, apart from loading its own files).
