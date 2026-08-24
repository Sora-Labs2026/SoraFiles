type ConvertRequest = {
  cmd: 'convert';
  jobId: string;
  inputPath: string;
  outputPath: string;
  filterName: 'writer_pdf_Export' | 'calc_pdf_Export';
};

type ZetaThread = {
  zetajs: {
    mainPort: MessagePort;
    catchUnoException(error: unknown): { Message?: string } | undefined;
  };
  css: {
    beans: { PropertyValue: new (value: { Name: string; Value: unknown }) => unknown };
    util: { XCloseable: unknown };
  };
  desktop: {
    loadComponentFromURL(url: string, target: string, flags: number, props: unknown[]): {
      close(deliverOwnership: boolean): void;
      storeToURL(url: string, props: unknown[]): void;
    };
  };
  thrPort: MessagePort;
};

type ZetaStore = {
  zetajs?: ZetaThread['zetajs'] & {
    uno: { com: { sun: { star: ZetaThread['css'] & { frame: { Desktop: { create(context: unknown): ZetaThread['desktop'] } } } } } };
    getUnoComponentContext(): unknown;
  };
};

function install(thread: ZetaThread) {
  const hidden = new thread.css.beans.PropertyValue({ Name: 'Hidden', Value: true });
  const overwrite = new thread.css.beans.PropertyValue({ Name: 'Overwrite', Value: true });
  let currentModel: ReturnType<ZetaThread['desktop']['loadComponentFromURL']> | undefined;

  thread.thrPort.onmessage = (event: MessageEvent<ConvertRequest>) => {
    if (event.data.cmd !== 'convert') return;
    const { jobId, inputPath, outputPath, filterName } = event.data;
    try {
      try { currentModel?.close(false); } catch {}
      const model = thread.desktop.loadComponentFromURL(`file://${inputPath}`, '_blank', 0, [hidden]);
      currentModel = model;
      const filter = new thread.css.beans.PropertyValue({ Name: 'FilterName', Value: filterName });
      model.storeToURL(`file://${outputPath}`, [overwrite, filter]);
      thread.zetajs.mainPort.postMessage({ cmd: 'success', jobId, outputPath });
    } catch (error) {
      let message = error instanceof Error ? error.message : 'LibreOffice could not convert this document.';
      try { message = thread.zetajs.catchUnoException(error)?.Message || message; } catch {}
      thread.zetajs.mainPort.postMessage({ cmd: 'error', jobId, message });
    }
  };

  thread.zetajs.mainPort.postMessage({ cmd: 'ready' });
}

const store = (globalThis as typeof globalThis & { zetajsStore?: ZetaStore }).zetajsStore;
if (!store?.zetajs) throw new Error('The local LibreOffice worker could not start.');
const zetajs = store.zetajs;
const css = zetajs.uno.com.sun.star;
const context = zetajs.getUnoComponentContext();
install({ zetajs, css, desktop: css.frame.Desktop.create(context), thrPort: zetajs.mainPort });
