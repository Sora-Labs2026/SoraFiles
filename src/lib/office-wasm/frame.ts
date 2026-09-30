import { convertOfficeToPdf } from './frame-runtime';

addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== parent || event.origin !== parent.location.origin || event.data?.type !== 'office-convert') return;
  const port = event.ports[0];
  if (!port) return;
  try {
    const bytes = await convertOfficeToPdf(event.data.file, event.data.kind, {
      onProgress: stage => port.postMessage({ type: 'progress', stage }),
    });
    port.postMessage({ type: 'result', bytes }, [bytes.buffer as ArrayBuffer]);
  } catch (error) {
    port.postMessage({ type: 'error', code: error instanceof Error && error.message === 'officeIsolation' ? 'officeIsolation' : 'officeFailed' });
  }
}, { once: true });
