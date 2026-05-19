import { EmbedPDFContainerProps } from "../../typings/EmbedPDFProps";

const categoryMap: Record<string, string[]> = {
    catZoom: ["zoom"],
    catZoomIn: ["zoom-in"],
    catZoomOut: ["zoom-out"],
    catZoomFitPage: ["zoom-fit-page"],
    catZoomFitWidth: ["zoom-fit-width"],
    catZoomMarquee: ["zoom-marquee"],
    catZoomLevel: ["zoom-level"],
    catAnnotation: ["annotation", "mode-annotate"],
    catAnnotationMarkup: ["annotation-markup"],
    catAnnotationHighlight: ["annotation-highlight"],
    catAnnotationUnderline: ["annotation-underline"],
    catAnnotationStrikeout: ["annotation-strikeout"],
    catAnnotationSquiggly: ["annotation-squiggly"],
    catAnnotationInk: ["annotation-ink"],
    catAnnotationText: ["annotation-text"],
    catAnnotationStamp: ["annotation-stamp", "stamp"],
    catAnnotationStyle: ["annotation-style", "panel-annotation-style"],
    catAnnotationInsertText: ["annotation-insert-text"],
    catAnnotationReplaceText: ["annotation-replace-text"],
    catAnnotationShape: ["annotation-shape", "mode-shapes"],
    catAnnotationRectangle: ["annotation-rectangle"],
    catAnnotationCircle: ["annotation-circle"],
    catAnnotationLine: ["annotation-line"],
    catAnnotationArrow: ["annotation-arrow"],
    catAnnotationPolygon: ["annotation-polygon"],
    catAnnotationPolyline: ["annotation-polyline"],
    catForm: ["form"],
    catFormTextfield: ["form-textfield"],
    catFormCheckbox: ["form-checkbox"],
    catFormRadio: ["form-radio"],
    catFormSelect: ["form-select"],
    catFormListbox: ["form-listbox"],
    catFormFillMode: ["form-fill-mode"],
    catInsert: ["insert"],
    catInsertRubberStamp: ["insert-rubber-stamp"],
    catInsertSignature: ["insert-signature"],
    catInsertImage: ["insert-image"],
    catRedaction: ["redaction", "mode-redact"],
    catRedactionArea: ["redaction-area"],
    catRedactionText: ["redaction-text"],
    catRedactionApply: ["redaction-apply"],
    catRedactionClear: ["redaction-clear"],
    catDocument: ["document"],
    catDocumentOpen: ["document-open"],
    catDocumentClose: ["document-close"],
    catDocumentPrint: ["document-print"],
    catDocumentCapture: ["document-capture"],
    catDocumentExport: ["document-export"],
    catDocumentFullscreen: ["document-fullscreen"],
    catDocumentProtect: ["document-protect"],
    catPage: ["page"],
    catSpread: ["spread"],
    catRotate: ["rotate"],
    catScroll: ["scroll"],
    catNavigation: ["navigation"],
    catPanel: ["panel"],
    catPanelSidebar: ["panel-sidebar"],
    catPanelSearch: ["panel-search"],
    catPanelComment: ["panel-comment"],
    catTools: ["tools"],
    catPan: ["pan"],
    catPointer: ["pointer"],
    catCapture: ["capture"],
    catSelection: ["selection"],
    catSelectionCopy: ["selection-copy"],
    catHistory: ["history"],
    catHistoryUndo: ["history-undo"],
    catHistoryRedo: ["history-redo"]
};

const readOnlyCategories: string[] = [
    "annotation",
    "mode-annotate",
    "mode-shapes",
    "annotation-markup",
    "annotation-highlight",
    "annotation-underline",
    "annotation-strikeout",
    "annotation-squiggly",
    "annotation-ink",
    "annotation-text",
    "annotation-stamp",
    "annotation-shape",
    "annotation-rectangle",
    "annotation-circle",
    "annotation-line",
    "annotation-arrow",
    "annotation-polygon",
    "annotation-polyline",
    "redaction",
    "mode-redact",
    "redaction-area",
    "redaction-text",
    "redaction-apply",
    "redaction-clear",
    "history",
    "history-undo",
    "history-redo",
    "document-open",
    "document-close",
    "document-capture",
    "document-protect"
];

export function getDisabledCategories(props: EmbedPDFContainerProps): string[] {
    const disabled: string[] = [];

    for (const [propKey, categories] of Object.entries(categoryMap)) {
        if (!(props as any)[propKey]) {
            disabled.push(...categories);
        }
    }

    if (!props.annotationsEnabled) {
        disabled.push("annotation", "mode-annotate", "mode-shapes");
    }

    if (props.readOnly) {
        disabled.push(...readOnlyCategories);
    }

    return disabled;
}
