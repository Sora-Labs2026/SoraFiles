# PDF structure repair

The local repair worker rewrites a readable PDF using the existing pdf-lib engine.
This can fix cross-reference offsets without changing the original. It cannot
recover missing objects, truncated streams or lost page content. It rejects
encrypted and digitally signed PDFs, including nested signature dictionaries.
No password removal path is provided.

Limits: 64 MB input/output, 100 pages, four million extracted characters,
one million rendering operations, 512 MB JavaScript heap and a two-minute timeout.
Cancellation terminates the worker before publication. The native host enforces
the ordinary signed entitlement and writes a separate collision-safe copy.

Before publication, PDF.js parses the source and output with strict error handling
and compares page boxes, rotation, text with transforms, and operation sequences.
These checks do not prove every annotation, font, attachment or advanced PDF
feature is intact. The UI and saved result require review of the repaired copy.

Fixtures corrupt the startxref offset and independently inspect the new offset,
pixel-identical page rendering, text, form values and an embedded attachment.
Other checks cover encryption/signature refusal, malformed/truncated input,
page limits, cancellation, batch failure isolation, collisions and authorization.
The isolated processing pack also runs the damaged-offset fixture. Broader
real-world corruption coverage is still needed before claiming general repair.
