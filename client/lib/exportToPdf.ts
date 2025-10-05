// /lib/exportToPdf.ts
// Client-only helper to export HTML to PDF with html2pdf.js

export type PdfExportOptions = {
  fileName?: string;
  marginMm?: number | [number, number, number, number];
  format?: "a4" | "letter" | "legal" | [number, number];
  orientation?: "portrait" | "landscape";
  extraCss?: string;
};

type Html2PdfInstance = {
  set(opts: any): Html2PdfInstance;
  from(src: HTMLElement | string | Document): Html2PdfInstance;
  save(): Promise<void>;
};
type Html2PdfFactory = () => Html2PdfInstance;

export async function exportHtmlToPdf(html: string, opts: PdfExportOptions = {}) {
  const {
    fileName = "document.pdf",
    marginMm = 10,
    format = "a4",
    orientation = "portrait",
    extraCss = "",
  } = opts;

  // Lazy import so SSR never evaluates the module
  const html2pdf = (await import("html2pdf.js")).default as unknown as Html2PdfFactory;

  // Wrap the HTML so we can inject print-only CSS
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <article id="pdf-root">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        article { font: 14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111827; }
        h1,h2,h3 { margin: 1.2em 0 .5em; line-height: 1.25; }
        p { margin: .6em 0; }
        ul,ol { margin: .6em 0 .6em 1.2em; }
        pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        blockquote { border-left: 4px solid #e5e7eb; padding-left: .9em; color:#374151; margin:.8em 0; }
        img { max-width: 100%; height: auto; }
        hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }

        /* 🔥 Treat ANY <hr> as a page break in the PDF output */
        #pdf-root hr,
        #pdf-root .html2pdf__page-break {
          page-break-after: always;
          break-after: page;      /* modern */
          border: 0;              /* no visible rule in PDF */
          margin: 0;              /* avoid pushing content down next page */
        }

        ${extraCss}
      </style>
      ${html}
    </article>
  `;

  const options = {
    filename: fileName,
    margin: marginMm,
    image: { type: "jpeg", quality: 0.96 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    },
    jsPDF: { unit: "mm", format, orientation },
    // Tell html2pdf to respect CSS and also break before <hr>
    pagebreak: {
      mode: ["css", "legacy"],
      before: ["hr", ".html2pdf__page-break"],
    },
  };

  await html2pdf().set(options).from(wrapper).save();
}

export async function exportNodeToPdf(node: HTMLElement, opts: PdfExportOptions = {}) {
  await exportHtmlToPdf(node.outerHTML, opts);
}