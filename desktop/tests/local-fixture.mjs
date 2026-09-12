import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// macOS /var is a system alias. Fixtures for the no-symlink output contract
// must start beneath the canonical temp directory, not that alias.
export async function localFixture(prefix){return mkdtemp(join(await realpath(tmpdir()),prefix));}
