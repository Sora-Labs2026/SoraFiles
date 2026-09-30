// Generated from src/lib/pdf-to-excel/table-extraction.ts by sync-pdf-tables.mjs.
const median = (values, fallback = 1) => {
    if (!values.length)
        return fallback;
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const typedValue = (raw) => {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!value)
        return '';
    const numeric = value.replace(/[,$£€¥₹\s]/g, '').replace(/^\((.+)\)$/, '-$1');
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)%$/.test(numeric))
        return Number(numeric.slice(0, -1)) / 100;
    if (/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value.replace(/[$£€¥₹\s]/g, ''))) {
        const parsed = Number(numeric);
        if (Number.isFinite(parsed))
            return parsed;
    }
    const isoDate = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoDate) {
        const date = new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])));
        if (!Number.isNaN(date.valueOf()))
            return date;
    }
    return value;
};
const normalize = (items) => items.flatMap((item) => {
    const text = item.str?.replace(/\s+/g, ' ').trim() ?? '';
    const transform = item.transform;
    if (!text || !transform || transform.length < 6)
        return [];
    const height = Math.max(1, Math.abs(Number(item.height) || Number(transform[3]) || 1));
    return [{
            text,
            x: Number(transform[4]) || 0,
            y: Number(transform[5]) || 0,
            width: Math.max(0, Number(item.width) || 0),
            height,
        }];
});
const clusterRows = (tokens) => {
    const rowTolerance = Math.max(2, median(tokens.map((token) => token.height), 8) * 0.55);
    const rows = [];
    for (const token of [...tokens].sort((a, b) => b.y - a.y || a.x - b.x)) {
        let row = rows.find((candidate) => Math.abs(candidate.y - token.y) <= rowTolerance);
        if (!row) {
            row = { y: token.y, height: token.height, tokens: [] };
            rows.push(row);
        }
        row.tokens.push(token);
        row.y = (row.y * (row.tokens.length - 1) + token.y) / row.tokens.length;
        row.height = Math.max(row.height, token.height);
    }
    rows.sort((a, b) => b.y - a.y);
    rows.forEach((row) => row.tokens.sort((a, b) => a.x - b.x));
    return rows;
};
const splitRegions = (rows) => {
    if (rows.length < 2)
        return rows.length ? [rows] : [];
    const gaps = rows.slice(1).map((row, index) => Math.max(0, rows[index].y - row.y));
    const normalGap = median(gaps.filter((gap) => gap > 0), median(rows.map((row) => row.height), 8) * 1.35);
    const regions = [[]];
    rows.forEach((row, index) => {
        if (index > 0) {
            const gap = rows[index - 1].y - row.y;
            if (gap > Math.max(normalGap * 2.4, rows[index - 1].height * 2.8))
                regions.push([]);
        }
        regions.at(-1).push(row);
    });
    return regions;
};
const columnAnchors = (rows) => {
    const all = rows.flatMap((row) => row.tokens.map((token) => token.x)).sort((a, b) => a - b);
    const widths = rows.flatMap((row) => row.tokens.map((token) => token.width / Math.max(1, token.text.length))).filter(Boolean);
    const tolerance = Math.max(5, Math.min(18, median(widths, 5) * 1.8));
    const clusters = [];
    for (const x of all) {
        const cluster = clusters.find((candidate) => Math.abs(candidate.x - x) <= tolerance);
        if (cluster) {
            cluster.x = (cluster.x * cluster.count + x) / (cluster.count + 1);
            cluster.count += 1;
        }
        else
            clusters.push({ x, count: 1 });
    }
    const support = Math.max(2, Math.ceil(rows.length * 0.18));
    const recurring = clusters.filter((cluster) => cluster.count >= support);
    const selected = recurring.length >= 2 ? recurring : clusters;
    return selected.sort((a, b) => a.x - b.x).slice(0, 40).map((cluster) => cluster.x);
};
const regionToTable = (rows, preserveText = false) => {
    const anchors = columnAnchors(rows);
    if (!anchors.length)
        return null;
    const matrix = rows.map((row) => {
        const cells = Array.from({ length: anchors.length }, () => '');
        for (const token of row.tokens) {
            let column = 0;
            let distance = Number.POSITIVE_INFINITY;
            anchors.forEach((anchor, index) => {
                const nextDistance = Math.abs(anchor - token.x);
                if (nextDistance < distance) {
                    distance = nextDistance;
                    column = index;
                }
            });
            cells[column] = cells[column] ? `${cells[column]} ${token.text}` : token.text;
        }
        return preserveText ? cells : cells.map(typedValue);
    });
    const populatedColumns = anchors.filter((_, index) => matrix.some((row) => row[index] !== '')).length;
    const denseRows = matrix.filter((row) => row.filter((cell) => cell !== '').length >= 2).length;
    if (rows.length < 2 || populatedColumns < 2 || denseRows < Math.min(2, rows.length))
        return null;
    return { rows: matrix, sourceRowCount: rows.length, columnCount: populatedColumns };
};
export function extractTablesFromTextItems(items, { preserveText = false } = {}) {
    const tokens = normalize(items);
    if (!tokens.length)
        return [];
    const rows = clusterRows(tokens);
    const regions = splitRegions(rows);
    const tables = regions.map((region) => regionToTable(region, preserveText)).filter((table) => Boolean(table));
    if (tables.length)
        return tables;
    const fallback = regionToTable(rows, preserveText);
    return fallback ? [fallback] : [];
}
