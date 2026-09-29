// Requested diagnostic modes must be proven by the native report. Release
// binaries deliberately omit development-only background/startup fixtures.
export function validateNativeSmokeReport(report, {background = false, startup = false, race = false} = {}) {
 if (report?.status !== 'PASS' || report.closeReopenCycles !== 2 || report.nativeWindowLoads !== 3
     || (report.nativeWindowBuilds !== undefined && report.nativeWindowBuilds !== report.nativeWindowLoads)
     || (background && report.backgroundJobState !== true)
     || (startup && report.trayOnlyStartup !== true)
     || (race && (report.windowRace !== true || report.nativeWindowBuilds !== 3))) {
  throw Error('Native lifecycle validation failed for the requested diagnostic mode');
 }
}
