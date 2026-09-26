export type CompressionProfileName = 'safe' | 'quality' | 'balanced' | 'strong' | 'max-safe' | 'smallest';

export interface PdfCompressionProfile {
  name: CompressionProfileName;
  label: string;
  dpi: number;
  qFactor: number;
  monoDpi: number;
  ssimFloor: number;
}

export interface ImageCompressionProfile {
  name: Exclude<CompressionProfileName, 'smallest'>;
  label: string;
  jpegQuality: number;
  webpQuality: number;
  ssimFloor: number;
}

const PDF_PROFILES: Record<CompressionProfileName, PdfCompressionProfile> = {
  safe: { name: 'safe', label: 'Safe optimization', dpi: 240, qFactor: .25, monoDpi: 300, ssimFloor: .985 },
  quality: { name: 'quality', label: 'Quality', dpi: 230, qFactor: .27, monoDpi: 300, ssimFloor: .985 },
  balanced: { name: 'balanced', label: 'Balanced', dpi: 200, qFactor: .35, monoDpi: 300, ssimFloor: .985 },
  strong: { name: 'strong', label: 'Strong', dpi: 180, qFactor: .42, monoDpi: 300, ssimFloor: .980 },
  'max-safe': { name: 'max-safe', label: 'Maximum safe', dpi: 150, qFactor: .55, monoDpi: 300, ssimFloor: .975 },
  smallest: { name: 'smallest', label: 'Smallest (opt-in)', dpi: 120, qFactor: .68, monoDpi: 300, ssimFloor: .970 },
};

const IMAGE_PROFILES: Record<Exclude<CompressionProfileName, 'smallest'>, ImageCompressionProfile> = {
  safe: { name: 'safe', label: 'Safe', jpegQuality: 90, webpQuality: 90, ssimFloor: .990 },
  quality: { name: 'quality', label: 'Quality', jpegQuality: 86, webpQuality: 86, ssimFloor: .990 },
  balanced: { name: 'balanced', label: 'Balanced', jpegQuality: 84, webpQuality: 85, ssimFloor: .990 },
  strong: { name: 'strong', label: 'Strong', jpegQuality: 82, webpQuality: 81, ssimFloor: .985 },
  'max-safe': { name: 'max-safe', label: 'Maximum safe', jpegQuality: 76, webpQuality: 75, ssimFloor: .975 },
};

export function profileNameForStrength(strength: number): Exclude<CompressionProfileName, 'smallest'> {
  const value = Math.max(0, Math.min(100, Math.round(strength)));
  if (value <= 29) return 'safe';
  if (value <= 54) return 'quality';
  if (value <= 74) return 'balanced';
  if (value <= 89) return 'strong';
  return 'max-safe';
}

export function pdfProfileForStrength(strength: number, allowSmallest = false): PdfCompressionProfile {
  if (allowSmallest && strength >= 100) return PDF_PROFILES.smallest;
  return PDF_PROFILES[profileNameForStrength(strength)];
}

export function imageProfileForStrength(strength: number, screenshot = false): ImageCompressionProfile {
  const base = IMAGE_PROFILES[profileNameForStrength(strength)];
  if (!screenshot) return base;
  return {
    ...base,
    jpegQuality: Math.max(base.jpegQuality, base.name === 'max-safe' ? 86 : 88),
    webpQuality: Math.max(base.webpQuality, 88),
    ssimFloor: Math.max(base.ssimFloor, .992),
  };
}

export function fallbackPdfProfile(profile: PdfCompressionProfile): PdfCompressionProfile | null {
  const fallback: Partial<Record<CompressionProfileName, CompressionProfileName>> = {
    smallest: 'max-safe',
    'max-safe': 'strong',
    strong: 'balanced',
    balanced: 'quality',
  };
  const next = fallback[profile.name];
  return next ? PDF_PROFILES[next] : null;
}

