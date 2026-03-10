import { ReactElement, createElement } from "react";
import { HelloWorldSample } from "./components/HelloWorldSample";
import { EmbedPDFPreviewProps } from "../typings/EmbedPDFProps";

export function preview({ sampleText }: EmbedPDFPreviewProps): ReactElement {
    return <HelloWorldSample sampleText={sampleText} />;
}

export function getPreviewCss(): string {
    return require("./ui/EmbedPDF.css");
}
