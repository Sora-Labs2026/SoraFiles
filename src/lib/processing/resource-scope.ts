type Disposer = () => void | Promise<void>;

interface CloseableBitmap {
  close(): void;
}

interface CollapsibleCanvas {
  width: number;
  height: number;
}

interface DestroyablePdfProxy {
  destroy(): void | Promise<void>;
}

interface TerminableWorker {
  terminate(): void | Promise<void>;
}

export class ResourceScope {
  #disposers: Disposer[] = [];
  #disposePromise: Promise<void> | null = null;
  #disposing = false;

  defer(dispose: Disposer): void {
    if (this.#disposing) {
      throw new Error('resource-scope-disposed');
    }

    this.#disposers.push(dispose);
  }

  trackObjectUrl(url: string): string {
    this.defer(() => URL.revokeObjectURL(url));
    return url;
  }

  trackImageBitmap<T extends CloseableBitmap>(bitmap: T): T {
    this.defer(() => bitmap.close());
    return bitmap;
  }

  trackCanvas<T extends CollapsibleCanvas>(canvas: T): T {
    this.defer(() => {
      canvas.width = 1;
      canvas.height = 1;
    });
    return canvas;
  }

  trackPdfProxy<T extends DestroyablePdfProxy>(proxy: T): T {
    this.defer(() => proxy.destroy());
    return proxy;
  }

  trackWorker<T extends TerminableWorker>(worker: T): T {
    this.defer(() => worker.terminate());
    return worker;
  }

  dispose(): Promise<void> {
    if (!this.#disposePromise) {
      this.#disposing = true;
      this.#disposePromise = Promise.resolve().then(() => this.#disposeAll());
    }

    return this.#disposePromise;
  }

  async #disposeAll(): Promise<void> {
    const errors: unknown[] = [];

    for (const dispose of this.#disposers.reverse()) {
      try {
        await dispose();
      } catch (error) {
        errors.push(error);
      }
    }

    this.#disposers = [];

    if (errors.length > 0) {
      throw new AggregateError(errors, 'resource-cleanup-failed');
    }
  }
}
