# Desktop Protect PDF

The Desktop worker uses the existing MIT-licensed `@pdfsmaller/pdf-encrypt` package
to add an opening password with AES-256 (PDF security revision 6). No password is
sent to licensing, written to preferences, logged, or returned in job results.
The UI confirms and masks passwords, then clears the fields before processing.
Passwords are limited to 127 normalized UTF-8 bytes to avoid silent truncation.

The worker accepts only unencrypted source PDFs and fails on already-protected
inputs. There is no Desktop password-removal operation. The worker checks its own
new output's encryption dictionary, requires a password in an independent parser,
and verifies that the supplied password opens the expected pages before saving.
The output writer verifies staged bytes before separate collision-safe publication.
Batch processing applies the supplied password to each selected unencrypted PDF.

Tests check rejected absent/wrong passwords, AES-256 parameters, text, page count,
form values, Unicode passwords, malformed input, cancellation and source
preservation. This is scoped fixture evidence, not universal document fidelity.
Adding encryption can invalidate existing digital signatures. Users must retain
their password; SoraFiles does not recover it.

The worker is a separate process with a 120-second timeout and V8 heap bound; it
does not establish OS sandbox containment. Full adversarial parser limits,
all-platform installation and redistribution provenance remain release work.
