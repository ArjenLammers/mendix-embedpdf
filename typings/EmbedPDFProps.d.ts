/**
 * This file was generated from EmbedPDF.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { DynamicValue, EditableValue, FileValue } from "mendix";
import { Big } from "big.js";

export interface EmbedPDFContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    file?: DynamicValue<FileValue>;
    activePage?: EditableValue<Big>;
}

export interface EmbedPDFPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    file: string;
    activePage: string;
}
