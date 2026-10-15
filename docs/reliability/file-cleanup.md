# File lifecycle cleanup (checklist 3.5)

Approved implementation plan:

1. Reproduce replacement, deletion/cascade, rollback, and shared-reference cases
   using temporary storage and a test database.
2. Add transactional cleanup records and post-commit attempts for avatars and
   book covers, with immutable upload keys and a reference check before deletion.
3. Keep failed work for bounded retries; provide a dry-run-first, grace-period
   orphan sweep for the currently configured local filesystem storage.
4. Verify failure, retry, rollback, path containment, and sweep behavior; run the
   complete repository verification set before checking off 3.5.

Decisions: storage deletion uses Django's storage API. The orphan sweep targets
the existing local filesystem backend, whose directories can be streamed without
loading a whole remote bucket listing. Remote object storage would need a
provider-specific bounded listing adapter before enabling its orphan sweep.
API and admin save paths share the same model lifecycle; delete signals also
cover queryset deletion and cascading user deletion. File replacement uses an
explicit atomic model-save wrapper rather than relying on autocommit signals.

## Lifecycle behavior

`User.save()` and `Book.save()` capture the previously stored filename inside
the database transaction. Replacing or clearing a field records its obsolete
filename in `uploads.FileDeletion` in the same transaction. Delete hooks cover
instance deletion, queryset/admin deletion, and user-to-book cascades. Their
pre-delete hook reads the current filename before the row disappears, including
when a caller supplied an older or deferred instance. Storage
deletion starts only after that transaction commits. Rolling back removes the
cleanup record and cancels its commit callback, preserving the original file.

Newly uploaded images receive UUID WebP names, so normal uploads do not overwrite
previous keys. Loaded instances remember their original filename. An unrelated
save of a stale instance preserves the current database filename rather than
restoring one already deleted by a replacement; cover dimensions follow the
preserved file. Deferred loading and `refresh_from_db()` maintain this snapshot.
`update_fields` that excludes the image field does not schedule file cleanup.

Before deleting, a worker checks both avatar and cover references again. A file
still referenced anywhere is preserved, and its current job is removed; removing
the last reference will create a new job. Missing files count as successful
idempotent deletions. Jobs are restricted to flat `avatars/` and `book_covers/`
keys. Absolute paths, traversal paths, nested paths, and local symlinks are not
followed. Custom upload locations require an explicit extension of this policy.

The current SQLite IMMEDIATE transaction coordinates managed model saves with
the worker's final reference check and deletion. The worker holds the writer
reservation during storage I/O, so slow storage can increase contention. Existing
API contention handling remains in effect. Other database engines and live cloud
providers have not been verified. Changes to storage configuration require
draining or explicitly migrating pending jobs before switching backends; jobs
resolve the current field storage, not historical storage credentials.

Storage errors preserve the job and do not turn a committed business update into
a failed response. Only the exception class is stored, without provider error
messages. Retry backoff starts at two minutes and caps at one day. Failed or
interrupted callbacks leave durable rows for later attempts. An API/admin request
may attempt local deletion immediately after commit; operators should monitor
queue age and storage latency, especially for large admin cascades.

Use model `save()` for image updates. `QuerySet.update()`, `bulk_update()`, direct
SQL, and external bucket changes bypass model lifecycle tracking; the sweep can
find their unreferenced local files later. Programmatic callers must not restore
retired keys or manually point records at missing files. Do not delete or rename
managed upload files externally while normal operations depend on them.

## Deployment and retry command

Run `python manage.py migrate` before serving the updated application.
`uploads.0001_initial` creates the cleanup queue without rewriting existing users
or books. This migration was applied successfully to the local development
database; production still needs it. No cleanup of existing development or
production uploads was executed during implementation.

Run `python manage.py retry_file_deletions --limit 100` periodically through your
deployment scheduler. This processes one batch of due rows, at most 5000, reports
outcomes, and exits unsuccessfully when storage deletions fail while retaining
those jobs. Jobs whose backoff has not elapsed are skipped. This change does not
install a scheduler or background service. Operators must arrange retries and
monitor retained failures.

## Dry-run orphan sweep

Storage writes cannot be rolled back by Django: an upload may remain when its
database transaction fails. The orphan sweep also covers older untracked files.
Inspect both managed directories first:

```text
python manage.py sweep_orphan_uploads --prefix avatars --limit 500
python manage.py sweep_orphan_uploads --prefix book_covers --limit 500
```

These commands only report candidates. `--apply` explicitly queues cleanup and
attempts it after commit. The default grace period is 24 hours; `--grace-hours`
allows 1–8760 hours. Live references and file modification time are checked again
by the worker, so a candidate becoming referenced or newer is preserved. Failed
deletions remain queued for the retry command.

Each invocation inspects at most `--limit` directory entries (1–5000), stores at
most that many candidate names in memory, and never recurses into directories or
follows symlinks. Output provides `next-offset`; supply that value with `--offset`
to continue. Skipping to an offset streams earlier entries without loading a
full listing, so its I/O cost grows with the offset. A batch that removes files
returns offset zero to avoid skipping entries whose directory positions changed.
Only a pass reporting `done` without removals completes the current traversal.
External directory mutations can still change enumeration order: quiesce uploads
for a reliable inventory and repeat passes when necessary. The grace period must
exceed the longest expected upload/transaction duration and relevant clock skew.

The sweep refuses non-filesystem storage. A future cloud deployment requires a
bounded provider listing adapter or inventory manifest before sweeping orphaned
objects. Lifecycle cleanup and retries still use the Django storage interface;
the tests cover a backend without filesystem paths, not a live cloud service.
There is no general recursive deletion or bucket-wide purge command.

## Verification ledger

The initial seven lifecycle tests reproduced four existing cleanup failures.
Retry and sweep tests first failed because those commands did not exist, then
passed after implementation. Final review identified stale-instance resurrection
and a sweep offset skipping files after deletion; dedicated regressions failed
before the fixes and passed afterward. A follow-up deletion regression reproduced
stale/deferred deletion leaving the current file behind; the pre-delete database
read fixes that path. Twenty-one focused tests now cover those
cases, rollback, shared references, storage failure/backoff, missing files,
bounded commands, deferred loading, path guards, and non-filesystem storage.

Two full Django attempts were deliberately interrupted while addressing the
review findings and the additional stale/deferred deletion regression; their
partial output is not counted as verification. The final full normal-hasher
Django suite ran 181 tests: 178 passed and three optional live Redis tests were
skipped. Frontend tests passed (68), ESLint passed, and
the production build passed with the verification-only URL
`https://api.verification-only.example/api`. Private `.env` files were unchanged.
Ruff, Django checks, and migration drift checks passed. Production checks using
verification-only HTTPS origins reported only intentional HSTS W005/W021 warnings.
`git diff --check` passed. All 240 source files checked were within 300 lines
(maximum 288); documentation is exempt. No live cloud provider, production
deployment, existing-upload purge, or scheduler installation was performed.
