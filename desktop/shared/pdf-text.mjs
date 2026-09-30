// Generated from src/lib/ocr/text-items.ts by sync-pdf-text.mjs.
export function groupTextItems(items) {
    const lines = [];
    let currentLine = [];
    let currentY = null;
    const flush = () => {
        if (!currentLine.length)
            return;
        const ordered = [...currentLine].sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
        let text = '';
        let previousEnd = null;
        let previousText = '';
        for (const item of ordered) {
            const raw = (item.str || '').normalize('NFC');
            if (!raw.trim())
                continue;
            const x = item.transform?.[4];
            const height = Math.max(1, Math.abs(item.height || item.transform?.[3] || 8));
            if (text && typeof x === 'number' && previousEnd !== null) {
                const gap = x - previousEnd;
                if (gap > Math.max(14, height * 1.7))
                    text += '\t';
                else if (gap > 1 && !/\s$/.test(previousText) && !/^\s/.test(raw))
                    text += ' ';
            }
            text += raw;
            previousEnd = typeof x === 'number' && typeof item.width === 'number' && item.width > 0 ? x + item.width : null;
            previousText = raw;
        }
        const lineText = text.split('\t').map((part) => part.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\t');
        if (lineText)
            lines.push(lineText);
        currentLine = [];
    };
    for (const item of items) {
        const y = item.transform && item.transform.length >= 6 ? item.transform[5] : null;
        if (currentY !== null && y !== null && Math.abs(y - currentY) > 2) {
            flush();
        }
        if (y !== null) {
            currentY = y;
        }
        currentLine.push(item);
        if (item.hasEOL) {
            flush();
            currentY = null;
        }
    }
    flush();
    return lines;
}
export function classifyPageText(items) {
    const lines = groupTextItems(items);
    const fullText = lines.join(' ');
    const meaningfulCharacters = fullText.replace(/[\p{P}\p{S}\s]/gu, '').length;
    const mode = meaningfulCharacters >= 12 ? 'embedded' : 'ocr';
    return {
        mode,
        lines,
        meaningfulCharacters,
    };
}
