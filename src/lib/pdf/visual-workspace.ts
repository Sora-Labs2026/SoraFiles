export interface PdfWorkspacePage {
  id: string;
  fileIndex: number;
  pageIndex: number;
  sourceName: string;
  width: number;
  height: number;
  rotation: number;
  selected: boolean;
}

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  cleanup: () => Promise<void>;
  destroy?: () => Promise<void>;
};

type Snapshot = PdfWorkspacePage[];

const clonePages = (pages: PdfWorkspacePage[]): Snapshot => pages.map((page) => ({ ...page }));
const normalizedRotation = (value: number) => ((value % 360) + 360) % 360;

export class VisualPdfWorkspace {
  private readonly root: HTMLElement;
  private readonly tool: string;
  private readonly grid: HTMLOListElement;
  private readonly summary: HTMLElement;
  private readonly range: HTMLInputElement;
  private readonly rangeError: HTMLElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly previewDialog: HTMLDialogElement;
  private readonly previewCanvas: HTMLCanvasElement;
  private readonly previewTitle: HTMLElement;
  private readonly mainCanvas: HTMLCanvasElement | null;
  private readonly mainStage: HTMLElement | null;
  private readonly activeTitle: HTMLElement | null;
  private documents: PdfDocumentLike[] = [];
  private pages: PdfWorkspacePage[] = [];
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private observer: IntersectionObserver | null = null;
  private generation = 0;
  private previewTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
  private mainTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
  private activePageId = '';
  private zoom = 1;

  constructor(root: HTMLElement) {
    this.root = root;
    this.tool = root.dataset.tool || '';
    this.grid = this.require<HTMLOListElement>('[data-pdf-page-grid]');
    this.summary = this.require('[data-pdf-workspace-summary]');
    this.range = this.require<HTMLInputElement>('[data-pdf-range]');
    this.rangeError = this.require('[data-pdf-range-error]');
    this.undoButton = this.require<HTMLButtonElement>('[data-pdf-undo]');
    this.redoButton = this.require<HTMLButtonElement>('[data-pdf-redo]');
    this.previewDialog = this.require<HTMLDialogElement>('[data-pdf-preview-dialog]');
    this.previewCanvas = this.require<HTMLCanvasElement>('[data-pdf-preview-canvas]');
    this.previewTitle = this.require('[data-pdf-preview-title]');
    this.mainCanvas = this.root.querySelector<HTMLCanvasElement>('[data-pdf-main-canvas]');
    this.mainStage = this.root.querySelector<HTMLElement>('[data-pdf-main-stage]');
    this.activeTitle = this.root.querySelector<HTMLElement>('[data-pdf-active-title]');
    this.bindControls();
  }

  private require<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing PDF workspace element: ${selector}`);
    return element;
  }

  async load(files: File[], openPdf: (file: File) => Promise<PdfDocumentLike>) {
    await this.clear();
    const generation = ++this.generation;
    const documents: PdfDocumentLike[] = [];
    const pages: PdfWorkspacePage[] = [];
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const document = await openPdf(files[fileIndex]);
        if (generation !== this.generation) { await document.destroy?.().catch(() => {}); return; }
        documents.push(document);
        for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
          const page = await document.getPage(pageIndex + 1);
          const viewport = page.getViewport({ scale: 1 });
          pages.push({
            id: `${fileIndex}-${pageIndex}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
            fileIndex,
            pageIndex,
            sourceName: files[fileIndex].name,
            width: viewport.width,
            height: viewport.height,
            rotation: 0,
            selected: this.tool !== 'remove-pages' && this.tool !== 'sign-pdf',
          });
          page.cleanup();
        }
      }
      this.documents = documents;
      this.pages = pages;
      this.activePageId = pages[0]?.id ?? '';
      this.zoom = 1;
      this.undoStack = [];
      this.redoStack = [];
      this.root.hidden = pages.length === 0;
      this.render();
    } catch (error) {
      await Promise.all(documents.map((document) => document.destroy?.().catch(() => {}) ?? document.cleanup().catch(() => {})));
      throw error;
    }
  }

  async clear() {
    this.generation += 1;
    this.observer?.disconnect();
    this.observer = null;
    this.previewTask?.cancel();
    this.previewTask = null;
    this.mainTask?.cancel();
    this.mainTask = null;
    if (this.previewDialog.open) this.previewDialog.close();
    const documents = this.documents.splice(0);
    await Promise.all(documents.map(async (document) => {
      try { if (document.destroy) await document.destroy(); else await document.cleanup(); } catch { /* best-effort PDF.js cleanup */ }
    }));
    this.pages = [];
    this.activePageId = '';
    this.undoStack = [];
    this.redoStack = [];
    this.grid.textContent = '';
    this.root.hidden = true;
  }

  getPages() { return clonePages(this.pages); }
  getSelectedPages() { return clonePages(this.pages.filter((page) => page.selected)); }

  selectPageIndices(indices: number[]) {
    const wanted = new Set(indices);
    this.commit(() => this.pages.forEach((page, index) => { page.selected = wanted.has(index); }));
  }

  private bindControls() {
    this.root.querySelectorAll<HTMLButtonElement>('[data-pdf-select]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.pdfSelect;
      this.commit(() => this.pages.forEach((page, index) => {
        const portrait = (page.rotation % 180 === 0 ? page.height >= page.width : page.width >= page.height);
        page.selected = mode === 'all' || (mode === 'odd' && index % 2 === 0) || (mode === 'even' && index % 2 === 1) || (mode === 'portrait' && portrait) || (mode === 'landscape' && !portrait);
      }));
    }));
    this.require<HTMLButtonElement>('[data-pdf-apply-range]').addEventListener('click', () => {
      try {
        const indices = this.parseRange(this.range.value);
        this.rangeError.hidden = true;
        this.selectPageIndices(indices);
      } catch (error) {
        this.rangeError.textContent = error instanceof Error ? error.message : 'Enter a valid page range.';
        this.rangeError.hidden = false;
        this.range.focus();
      }
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-pdf-rotate]').forEach((button) => button.addEventListener('click', () => {
      const delta = Number(button.dataset.pdfRotate);
      this.commit(() => this.pages.forEach((page) => { if (page.selected) page.rotation = normalizedRotation(page.rotation + delta); }));
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-pdf-move]').forEach((button) => button.addEventListener('click', () => this.moveSelected(Number(button.dataset.pdfMove))));
    this.root.querySelector<HTMLButtonElement>('[data-pdf-duplicate]')?.addEventListener('click', () => this.commit(() => {
      const next: PdfWorkspacePage[] = [];
      this.pages.forEach((page) => { next.push(page); if (page.selected) next.push({ ...page, id: `${page.id}-copy-${Math.random().toString(36).slice(2)}`, selected: true }); });
      this.pages = next;
    }));
    this.root.querySelector<HTMLButtonElement>('[data-pdf-delete]')?.addEventListener('click', () => {
      if (!this.pages.some((page) => page.selected) || this.pages.every((page) => page.selected)) return;
      this.commit(() => { this.pages = this.pages.filter((page) => !page.selected); });
    });
    this.undoButton.addEventListener('click', () => this.undo());
    this.redoButton.addEventListener('click', () => this.redo());
    this.require<HTMLButtonElement>('[data-pdf-preview-close]').addEventListener('click', () => this.previewDialog.close());
    this.previewDialog.addEventListener('close', () => { this.previewTask?.cancel(); this.previewTask = null; this.previewCanvas.width = 1; this.previewCanvas.height = 1; });
    this.root.closest<HTMLElement>('[data-adaptive-workspace]')?.addEventListener('workspace-command', (event) => {
      const command = (event as CustomEvent<{ command?: string }>).detail?.command;
      if (command === 'undo' && this.tool !== 'sign-pdf') this.undo();
      else if (command === 'redo' && this.tool !== 'sign-pdf') this.redo();
      else if (command === 'zoom-in') this.setZoom(this.zoom + .15);
      else if (command === 'zoom-out') this.setZoom(this.zoom - .15);
      else if (command === 'fit') this.setZoom(1);
    });
  }

  private setZoom(value: number) {
    this.zoom = Math.max(.55, Math.min(2.5, value));
    this.syncZoomOutput();
    void this.renderMainPage();
  }

  private syncZoomOutput() {
    const output = this.root.closest<HTMLElement>('[data-adaptive-workspace]')?.querySelector<HTMLOutputElement>('[data-workspace-zoom]');
    if (output) output.value = this.zoom === 1 ? 'Fit' : `${Math.round(this.zoom * 100)}%`;
  }

  private parseRange(value: string) {
    if (!value.trim()) throw new Error('Enter at least one page number.');
    const selected = new Set<number>();
    for (const part of value.split(',')) {
      const token = part.trim();
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
      if (!match) throw new Error(`“${token}” is not a page number or range.`);
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (start < 1 || end < start || end > this.pages.length) throw new Error(`Use pages 1 to ${this.pages.length}.`);
      for (let page = start; page <= end; page += 1) selected.add(page - 1);
    }
    return [...selected];
  }

  private commit(change: () => void) {
    this.undoStack.push(clonePages(this.pages));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
    change();
    this.render();
    this.root.closest<HTMLElement>('[data-adaptive-workspace]')?.dispatchEvent(new CustomEvent('workspace-dirty'));
  }

  private undo() {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    this.redoStack.push(clonePages(this.pages));
    this.pages = snapshot;
    this.render();
  }

  private redo() {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    this.undoStack.push(clonePages(this.pages));
    this.pages = snapshot;
    this.render();
  }

  private moveSelected(direction: number) {
    this.commit(() => {
      if (direction < 0) {
        for (let index = 1; index < this.pages.length; index += 1) if (this.pages[index].selected && !this.pages[index - 1].selected) [this.pages[index - 1], this.pages[index]] = [this.pages[index], this.pages[index - 1]];
      } else {
        for (let index = this.pages.length - 2; index >= 0; index -= 1) if (this.pages[index].selected && !this.pages[index + 1].selected) [this.pages[index + 1], this.pages[index]] = [this.pages[index], this.pages[index + 1]];
      }
    });
  }

  private render() {
    this.observer?.disconnect();
    this.grid.textContent = '';
    this.pages.forEach((page, index) => this.grid.append(this.createCard(page, index)));
    const selected = this.pages.filter((page) => page.selected).length;
    this.summary.textContent = `${this.pages.length} ${this.pages.length === 1 ? 'page' : 'pages'} · ${selected} selected`;
    this.undoButton.disabled = this.undoStack.length === 0;
    this.redoButton.disabled = this.redoStack.length === 0;
    this.observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      this.observer?.unobserve(entry.target);
      void this.renderThumbnail(entry.target as HTMLCanvasElement);
    }), { root: this.grid, rootMargin: '180px' });
    this.grid.querySelectorAll<HTMLCanvasElement>('canvas[data-page-id]').forEach((canvas) => this.observer?.observe(canvas));
    this.root.dispatchEvent(new CustomEvent('pdf-workspace-change', { bubbles: true, detail: { pages: this.getPages() } }));
    this.syncZoomOutput();
    if (this.mainCanvas) void this.renderMainPage();
  }

  private createCard(page: PdfWorkspacePage, index: number) {
    const item = document.createElement('li');
    item.dataset.pdfPageCard = '';
    item.setAttribute('aria-selected', String(page.selected));
    item.className = 'group relative min-w-0 rounded-lg border border-line bg-surface p-1.5 transition';
    const open = document.createElement('button'); open.type = 'button'; open.dataset.pdfOpenPage = ''; open.className = 'block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue'; open.setAttribute('aria-label', `Show page ${index + 1} from ${page.sourceName}`); open.addEventListener('click', () => this.setActivePage(page, index)); open.addEventListener('dblclick', () => void this.openPreview(page, index));
    const stage = document.createElement('span'); stage.className = 'relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-md bg-white';
    const canvas = document.createElement('canvas'); canvas.dataset.pageId = page.id; canvas.className = 'block max-h-full max-w-full bg-white'; canvas.setAttribute('aria-hidden', 'true'); canvas.style.transform = `rotate(${page.rotation}deg)`;
    const mark = document.createElement('span'); mark.dataset.pdfSelectedMark = ''; mark.className = 'absolute right-2 top-2 grid h-7 w-7 scale-75 place-items-center rounded-full bg-blue text-sm font-bold text-white opacity-0 shadow-small transition'; mark.textContent = '✓'; mark.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    const label = document.createElement('span'); label.className = 'mt-1.5 flex min-w-0 items-center justify-between gap-1 text-[10px]'; const number = document.createElement('strong'); number.textContent = `${index + 1}`; const source = document.createElement('span'); source.className = 'truncate text-muted'; source.textContent = page.sourceName; label.append(number, source); open.append(stage, label);
    const select = document.createElement('button'); select.type = 'button'; select.className = 'absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-surface text-xs font-bold text-muted shadow-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue'; select.setAttribute('aria-label', `${page.selected ? 'Deselect' : 'Select'} page ${index + 1} from ${page.sourceName}`); select.append(mark); select.addEventListener('click', () => this.commit(() => { const current = this.pages.find((candidate) => candidate.id === page.id); if (current) current.selected = !current.selected; }));
    item.append(open, select);
    return item;
  }

  private setActivePage(page: PdfWorkspacePage, index: number) {
    this.activePageId = page.id;
    if (this.activeTitle) this.activeTitle.textContent = `Page ${index + 1} · ${page.sourceName}`;
    const pageInput = this.root.querySelector<HTMLInputElement>('#signature-page');
    if (pageInput) {
      pageInput.value = String(page.pageIndex + 1);
      pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else void this.renderMainPage();
  }

  private async renderMainPage() {
    if (!this.mainCanvas || !this.mainStage) return;
    const pageModel = this.pages.find((page) => page.id === this.activePageId) ?? this.pages[0];
    if (!pageModel) return;
    this.mainTask?.cancel();
    const page = await this.documents[pageModel.fileIndex]?.getPage(pageModel.pageIndex + 1);
    if (!page || !this.mainCanvas.isConnected) return;
    const rotation = normalizedRotation((page.rotate || 0) + pageModel.rotation);
    const base = page.getViewport({ scale: 1, rotation });
    const availableWidth = Math.max(220, this.mainStage.clientWidth - 42);
    const availableHeight = Math.max(260, this.mainStage.clientHeight - 42);
    const fitScale = Math.min(availableWidth / base.width, availableHeight / base.height);
    const cssScale = Math.max(.15, fitScale * this.zoom);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: cssScale * pixelRatio, rotation });
    this.mainCanvas.width = Math.max(1, Math.ceil(viewport.width));
    this.mainCanvas.height = Math.max(1, Math.ceil(viewport.height));
    this.mainCanvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`;
    this.mainCanvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;
    const context = this.mainCanvas.getContext('2d', { alpha: false });
    if (!context) return;
    context.fillStyle = '#fff'; context.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
    if (this.activeTitle) this.activeTitle.textContent = `Page ${this.pages.indexOf(pageModel) + 1} · ${pageModel.sourceName}`;
    const task = page.render({ canvas: this.mainCanvas, canvasContext: context, viewport, background: '#fff' });
    this.mainTask = task;
    try { await task.promise; } catch (error) { if (!(error instanceof Error) || !/cancel/i.test(error.name + error.message)) throw error; }
    finally { if (this.mainTask === task) this.mainTask = null; page.cleanup(); }
  }

  private async renderThumbnail(canvas: HTMLCanvasElement) {
    const pageModel = this.pages.find((page) => page.id === canvas.dataset.pageId);
    if (!pageModel || !canvas.isConnected) return;
    const page = await this.documents[pageModel.fileIndex]?.getPage(pageModel.pageIndex + 1);
    if (!page || !canvas.isConnected) return;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 220 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d', { alpha: false });
    if (context) { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); await page.render({ canvas, canvasContext: context, viewport, background: '#fff' }).promise; }
    page.cleanup();
  }

  private async openPreview(pageModel: PdfWorkspacePage, index: number) {
    this.previewTask?.cancel();
    const page = await this.documents[pageModel.fileIndex]?.getPage(pageModel.pageIndex + 1);
    if (!page) return;
    const base = page.getViewport({ scale: 1, rotation: normalizedRotation((page.rotate || 0) + pageModel.rotation) });
    const availableWidth = Math.max(260, Math.min(900, window.innerWidth - 80));
    const availableHeight = Math.max(320, window.innerHeight - 150);
    const cssScale = Math.min(availableWidth / base.width, availableHeight / base.height, 1.7);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: cssScale * pixelRatio, rotation: normalizedRotation((page.rotate || 0) + pageModel.rotation) });
    this.previewCanvas.width = Math.max(1, Math.ceil(viewport.width)); this.previewCanvas.height = Math.max(1, Math.ceil(viewport.height));
    this.previewCanvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`; this.previewCanvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;
    const context = this.previewCanvas.getContext('2d', { alpha: false }); if (!context) return;
    context.fillStyle = '#fff'; context.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
    this.previewTitle.textContent = `Page ${index + 1} · ${pageModel.sourceName}`;
    if (!this.previewDialog.open) this.previewDialog.showModal();
    const task = page.render({ canvas: this.previewCanvas, canvasContext: context, viewport, background: '#fff' }); this.previewTask = task;
    try { await task.promise; } catch (error: any) { if (error?.name !== 'RenderingCancelledException') throw error; }
    if (this.previewTask === task) this.previewTask = null;
    page.cleanup();
  }
}
