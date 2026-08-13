declare module 'utif' {
  interface TiffPage {
    width: number;
    height: number;
    [key: string]: unknown;
  }

  const UTIF: {
    decode(buffer: ArrayBuffer): TiffPage[];
    decodeImage(buffer: ArrayBuffer, page: TiffPage): void;
    toRGBA8(page: TiffPage): Uint8Array;
  };

  export default UTIF;
}
