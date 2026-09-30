# Windows processing process cleanup

Each on-demand license or processing component joins a Windows Job Object with
`KILL_ON_JOB_CLOSE` before the host supplies its private request. Bundled entry
points wait for that request before starting engine workers. Descendants inherit
the job; no breakaway flag is enabled. Attachment failure stops the component
before any private state is sent.

The native host closes the job on completion, failure and cleanup. Host termination
also closes its non-inherited job handle. Worker processes cannot keep the output
pipe open indefinitely after their parent exits. A real Windows test starts a
Node component and its separate worker, closes the job and verifies both process
handles signal termination. Real offline engine/private-pipe tests also pass.

This provides process-tree lifetime cleanup, not a filesystem/network sandbox or
a guarantee against hostile native code. Engine time/size limits remain separate.
Equivalent Unix process-tree handling, host-crash fault injection and installed
platform resource measurements are still release work.
