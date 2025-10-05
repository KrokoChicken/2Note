// /types/html2pdf/index.d.ts
declare module "html2pdf.js" {
  /** Extra page-break options supported at runtime by html2pdf.js */
  export interface Html2PdfPagebreak {
    /** e.g. ["css", "legacy"] */
    mode?: string[];
    /** CSS selectors that should start a new page */
    before?: string | string[];
    /** CSS selectors that should end the current page */
    after?: string | string[];
    /** CSS selectors that should avoid breaking inside */
    avoid?: string | string[];
  }

  export interface Html2PdfOptions {
    filename?: string;
    margin?: number | [number, number, number, number];
    image?: {
      type?: string; // "jpeg" | "png"
      quality?: number; // 0..1
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      logging?: boolean;
      backgroundColor?: string | null;
    };
    jsPDF?: {
      unit?: "pt" | "mm" | "cm" | "in";
      format?: string | [number, number]; // "a4" | "letter" | custom tuple
      orientation?: "portrait" | "landscape";
    };
    /** Runtime-supported but often missing from typings */
    pagebreak?: Html2PdfPagebreak;
  }

  export interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(src: HTMLElement | string | Document): Html2PdfInstance;
    save(): Promise<void>;
    // Common extra chain steps (not strictly needed for .save())
    toContainer?(): Html2PdfInstance;
    toCanvas?(): Html2PdfInstance;
    toImg?(): Html2PdfInstance;
    toPdf?(): Html2PdfInstance;
    output?(): Promise<Blob | string>;
  }

  export type Html2PdfFactory = () => Html2PdfInstance;

  const html2pdf: Html2PdfFactory;
  export default html2pdf;
}