// UNO MediaDescriptor uses short values for these two policies. A plain JS
// integer becomes UNO long in ZetaJS and can silently miss the expected type.
export function officeImportProperties(zeta, css) {
 const property = (Name, Value) => new css.beans.PropertyValue({Name, Value});
 const abortHandler = zeta.unoObject([css.task.XInteractionHandler], {
  handle(request) {
   for (const continuation of request.getContinuations()) {
    const abort = continuation.queryInterface(zeta.type.interface(css.task.XInteractionAbort));
    if (abort) { abort.select(); return; }
   }
   throw Error('Office import requires unsupported interaction');
  },
 });
 return [property('Hidden', true), property('ReadOnly', true),
  property('MacroExecutionMode', new zeta.Any(zeta.type.short, 0)),
  property('UpdateDocMode', new zeta.Any(zeta.type.short, 0)),
  property('InteractionHandler', abortHandler)];
}
