# Closing the window during processing

When the native tray menu is available, closing the window destroys its WebView
and lets the current processing component finish. The native host retains one
bounded job snapshot: tool ID, source basenames, public results and generic errors.
Passwords, processing options, full paths and license material are not copied
into this snapshot. Heavy engines exit normally after the job.

Reopening restores status and polls only while that job is running. Cancellation
remains available, and completed outputs keep their Open result/folder IDs. The
next ordinary window close clears these retained results. The snapshot is memory
only: application crashes, a full quit, logout and shutdown do not persist it.

If the tray menu could not be created, closing during processing is still refused
so the job is not left without a way to reopen its controls. Explicit Quit while
processing asks the user to wait or cancel. Login startup and installed Explorer,
Finder and Linux context menus remain separate unfinished integration work.

Job acceptance and window closure are serialized. Setup errors replace the
current snapshot, so reopening cannot mistake an earlier result for the new job.

Browser QA verifies reconnecting a recreated renderer. The optional debug smoke
`node desktop/scripts/run-native-smoke.mjs <exe> --background-job` now processes
a real synthetic PDF after confirming the WebView has been destroyed. It starts
a synthetic trial with memory-only wrapping keys, stops the local license service,
rotates the PDF offline, checks the output and original, reopens the UI, resolves
the saved-output ID, and checks that the next idle close clears the result.
The fixture uses a fresh temporary directory and never touches installed license
state. This Windows diagnostic passed; it is not an installer or production
paid-license test. It requires the development checkout and Node on PATH.
Installed OS lifecycle, sleep/logout/crash and background memory measurements
remain required before release. See the recovery ledger for collected results.
