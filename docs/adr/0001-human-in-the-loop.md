# ADR 0001: Require user review before publication

- Status: Accepted

## Decision

ReplyLoom may insert a user-selected draft into X's reply editor. It must never
activate the final Reply or Post control. Users must be able to review and edit
the exact text before publishing it themselves.

## Consequences

Insertion and publication remain separate actions. Copying is available when
insertion fails. Tests and browser verification should check that generation
and insertion never trigger publication. Batch and unattended publication are
outside the project's scope.
