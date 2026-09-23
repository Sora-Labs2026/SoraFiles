// Requested diagnostic modes must be proven by the native report. Release
// binaries deliberately omit development-only background/startup fixtures.
export function validateNativeSmokeReport(report, {background = false, startup = false} = {}) {
 if (report?.status !== 'PASS' || report.closeReopenCycles !== 2 || report.nativeWindowLoads !== 3
     || (background && report.backgroundJobState !== true)
     || (startup && report.trayOnlyStartup !== true)) {
  throw Error('Native lifecycle validation failed for the requested diagnostic mode');
 }
}
