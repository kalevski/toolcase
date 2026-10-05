// Entry point of the sdkjs suite: registers every area's cases, runs them sequentially and prints
// @@RESULT lines (see harness.mjs). Run through ../../run.sh; BV_JS_ONLY=<regex> selects cases.
import { run } from './harness.mjs';

const areas = [
    './a_objects.mjs',
    './b_listing.mjs',
    './c_presign.mjs',
    './d_multipart.mjs',
    './e_checksums.mjs',
    './f_features.mjs',
    './g_oddkeys.mjs',
];
for (const a of areas) {
    try {
        await import(a);
    } catch (e) {
        if (e?.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(a.slice(2))) continue; // area not written yet
        throw e;
    }
}
await run();
// open keep-alive sockets / timers of failed cases must not keep the process alive
await new Promise((r) => process.stdout.write('', r));
process.exit(0);
