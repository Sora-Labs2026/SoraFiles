setTimeout(async () => {
  await document.fonts.ready;
  const width = innerWidth;
  const height = innerHeight;
  const layout = {
    width, height, scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('main, main *')].map(element => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, className: String(element.className).slice(0, 120), left: rect.left, right: rect.right };
    }).filter(rect => rect.right > width + 1 || rect.left < -1).slice(0, 12)
  };
  await window.__TAURI__.core.invoke('host_request', { method: 'smokeReport', params: {
    heading: document.querySelector('h1')?.textContent || null,
    tools: document.querySelectorAll('[data-tool]').length,
    overflow: document.documentElement.scrollWidth > width,
    error: width < 760 || height < 600 ? 'Native viewport was not allocated at its minimum size' : document.querySelector('[role=alert]')?.textContent || null,
    layout
  }});
}, 800);
