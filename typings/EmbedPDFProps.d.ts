/**
 * This file was generated from EmbedPDF.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, DynamicValue, EditableValue, FileValue } from "mendix";
import { Big } from "big.js";

export type ThemePreferenceEnum = "light" | "dark" | "system";

export interface EmbedPDFContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    file?: DynamicValue<FileValue>;
    activePage?: EditableValue<Big>;
    themePreference: ThemePreferenceEnum;
    readOnly: boolean;
    catZoom: boolean;
    catZoomIn: boolean;
    catZoomOut: boolean;
    catZoomFitPage: boolean;
    catZoomFitWidth: boolean;
    catZoomMarquee: boolean;
    catZoomLevel: boolean;
    catAnnotation: boolean;
    catAnnotationMarkup: boolean;
    catAnnotationHighlight: boolean;
    catAnnotationUnderline: boolean;
    catAnnotationStrikeout: boolean;
    catAnnotationSquiggly: boolean;
    catAnnotationInk: boolean;
    catAnnotationText: boolean;
    catAnnotationStamp: boolean;
    catAnnotationShape: boolean;
    catAnnotationRectangle: boolean;
    catAnnotationCircle: boolean;
    catAnnotationLine: boolean;
    catAnnotationArrow: boolean;
    catAnnotationPolygon: boolean;
    catAnnotationPolyline: boolean;
    catRedaction: boolean;
    catRedactionArea: boolean;
    catRedactionText: boolean;
    catRedactionApply: boolean;
    catRedactionClear: boolean;
    catDocument: boolean;
    catDocumentOpen: boolean;
    catDocumentClose: boolean;
    catDocumentPrint: boolean;
    catDocumentCapture: boolean;
    catDocumentExport: boolean;
    catDocumentFullscreen: boolean;
    catDocumentProtect: boolean;
    catPage: boolean;
    catSpread: boolean;
    catRotate: boolean;
    catScroll: boolean;
    catNavigation: boolean;
    catPanel: boolean;
    catPanelSidebar: boolean;
    catPanelSearch: boolean;
    catPanelComment: boolean;
    catTools: boolean;
    catPan: boolean;
    catPointer: boolean;
    catCapture: boolean;
    catSelection: boolean;
    catSelectionCopy: boolean;
    catHistory: boolean;
    catHistoryUndo: boolean;
    catHistoryRedo: boolean;
    annotationsEnabled: boolean;
    autoCommit: boolean;
    annotationAuthor?: EditableValue<string>;
    selectAfterCreate: boolean;
    xfdf?: EditableValue<string>;
    onXfdfChange?: ActionValue;
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
    themePreference: ThemePreferenceEnum;
    readOnly: boolean;
    catZoom: boolean;
    catZoomIn: boolean;
    catZoomOut: boolean;
    catZoomFitPage: boolean;
    catZoomFitWidth: boolean;
    catZoomMarquee: boolean;
    catZoomLevel: boolean;
    catAnnotation: boolean;
    catAnnotationMarkup: boolean;
    catAnnotationHighlight: boolean;
    catAnnotationUnderline: boolean;
    catAnnotationStrikeout: boolean;
    catAnnotationSquiggly: boolean;
    catAnnotationInk: boolean;
    catAnnotationText: boolean;
    catAnnotationStamp: boolean;
    catAnnotationShape: boolean;
    catAnnotationRectangle: boolean;
    catAnnotationCircle: boolean;
    catAnnotationLine: boolean;
    catAnnotationArrow: boolean;
    catAnnotationPolygon: boolean;
    catAnnotationPolyline: boolean;
    catRedaction: boolean;
    catRedactionArea: boolean;
    catRedactionText: boolean;
    catRedactionApply: boolean;
    catRedactionClear: boolean;
    catDocument: boolean;
    catDocumentOpen: boolean;
    catDocumentClose: boolean;
    catDocumentPrint: boolean;
    catDocumentCapture: boolean;
    catDocumentExport: boolean;
    catDocumentFullscreen: boolean;
    catDocumentProtect: boolean;
    catPage: boolean;
    catSpread: boolean;
    catRotate: boolean;
    catScroll: boolean;
    catNavigation: boolean;
    catPanel: boolean;
    catPanelSidebar: boolean;
    catPanelSearch: boolean;
    catPanelComment: boolean;
    catTools: boolean;
    catPan: boolean;
    catPointer: boolean;
    catCapture: boolean;
    catSelection: boolean;
    catSelectionCopy: boolean;
    catHistory: boolean;
    catHistoryUndo: boolean;
    catHistoryRedo: boolean;
    annotationsEnabled: boolean;
    autoCommit: boolean;
    annotationAuthor: string;
    selectAfterCreate: boolean;
    xfdf: string;
    onXfdfChange: {} | null;
}
