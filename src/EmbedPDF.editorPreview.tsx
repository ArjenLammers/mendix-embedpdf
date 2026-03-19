import { ReactElement, createElement } from "react";
import { EmbedPDFPreviewProps } from "../typings/EmbedPDFProps";

export function preview(_props: EmbedPDFPreviewProps): ReactElement {
    return <div className="widget-embed-pdf-preview">[Embed PDF]</div>;
}

export function getPreviewCss(): string {
    return require("./ui/EmbedPDF.css");
}
