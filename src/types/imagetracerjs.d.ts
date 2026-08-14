declare module "imagetracerjs" {
  export interface ImageTracerImageData {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray | Buffer;
  }

  export interface ImageTracerPaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  export interface ImageTracerOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: 0 | 1 | 2;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: 0 | 1;
    strokewidth?: number;
    linefilter?: boolean;
    scale?: number;
    roundcoords?: number;
    viewbox?: boolean;
    desc?: boolean;
    blurradius?: number;
    blurdelta?: number;
    pal?: ImageTracerPaletteColor[];
  }

  export interface ImageTracerTraceData {
    layers: unknown[][];
    palette: ImageTracerPaletteColor[];
    width: number;
    height: number;
  }

  const ImageTracer: {
    imagedataToTracedata(imgd: ImageTracerImageData, options?: ImageTracerOptions): ImageTracerTraceData;
    getsvgstring(tracedata: ImageTracerTraceData, options?: ImageTracerOptions): string;
  };

  export default ImageTracer;
}
