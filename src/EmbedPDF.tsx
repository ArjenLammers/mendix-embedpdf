'use client'

import { ReactElement, createElement, useCallback, useEffect, useRef } from "react";
import { EmbedPDFContainerProps } from "../typings/EmbedPDFProps";
import { Big } from "big.js";
import { PDFViewerRef, PDFViewer, AnnotationPlugin, 
    ScrollEvent, DocumentManagerPlugin, ScrollPlugin, AnnotationEvent } from "@embedpdf/react-pdf-viewer";

import "./ui/EmbedPDF.css";
import { getAnnotationsAsXFDF, parseXFDF } from "./utils/xfdf";
import { getGuidFromUrl } from "./utils/url";

export function EmbedPDF(props: EmbedPDFContainerProps): ReactElement {
    const { file, activePage, xfdf, onXfdfChange, annotationsEnabled, autoCommit, annotationAuthor, selectAfterCreate } = props;

    const viewerRef = useRef<PDFViewerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const xfdfRef = useRef(xfdf);
    const onXfdfChangeRef = useRef(onXfdfChange);
    const hasImportedAnnotations = useRef<string | null>(null); // Track which document we've imported for
    const currentDocumentGuid = useRef<string | null>(null); // Track currently opened document GUID
    const pendingImportCount = useRef(0); // Count of annotations being imported
    const pendingDeleteCount = useRef(0); // Count of annotations being deleted
    const importTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for import completion
    let listeningToPageChanges = false;

    // Keep refs in sync with props
    useEffect(() => {
        xfdfRef.current = xfdf;
    }, [xfdf]);

    useEffect(() => {
        onXfdfChangeRef.current = onXfdfChange;
    }, [onXfdfChange]);

    useEffect(() => {
        const sync = async () => {
            const registry = await viewerRef.current?.registry;
            const docManager = registry
                ?.getPlugin<DocumentManagerPlugin>('document-manager')
                ?.provides() as DocumentManagerPlugin;
            const fileGuid = file?.value?.uri ? getGuidFromUrl(file.value.uri) : null;
            if (file?.value?.uri && fileGuid && fileGuid !== currentDocumentGuid.current) {
                console.info("Opening document", file.value.uri, "GUID:", fileGuid);
                currentDocumentGuid.current = fileGuid;
                // Reset import tracking when opening a new document
                hasImportedAnnotations.current = null;
                await docManager.closeAllDocuments().toPromise();
                docManager.openDocumentUrl({
                    url: file?.value?.uri || '',
                    autoActivate: true
                });
            }
        }
        sync();        
    }, [ file ]);

    useEffect(() => {
        if (!listeningToPageChanges && activePage) {
            const sync = async () => {  
                const registry = await viewerRef.current?.registry;
                const scrollPlugin = registry
                    ?.getPlugin<ScrollPlugin>('scroll')
                    ?.provides() as ScrollPlugin;    
                scrollPlugin.onPageChange((event: ScrollEvent) => {
                    activePage.setValue(new Big(event.pageNumber));
                });
                listeningToPageChanges = true;
            };
            sync();
        }  

        if (activePage?.status === "available") {
            const sync = async () => {   
                const registry = await viewerRef.current?.registry;
                const docManager = registry
                    ?.getPlugin<DocumentManagerPlugin>('document-manager')
                    ?.provides() as DocumentManagerPlugin;
                const activeDoc = docManager?.getActiveDocument();
                if (!activeDoc) {
                    return; // No active document yet, skip scrolling
                }
                const scrollPlugin = registry
                    ?.getPlugin<ScrollPlugin>('scroll')
                    ?.provides() as ScrollPlugin;
                scrollPlugin.scrollToPage({
                    pageNumber: activePage.value?.toNumber() || 0,
                    behavior: 'smooth'
                });
            }
            sync();
        }
    }, [ activePage ]);

    /**
     * To explain dark magic in here, there are some design decisions to keep into account:
     *  - A PDF document can contain annotations itself. When we haven't got XFDF contents yet, we keep this in place. On the next change, they should all be serialized and contained into the XFDF.
     *  - When a PDF document contains annotations, their ID will be re-generated when imported by the PDF viewer. This means we can't combine the XFDF annotations with the existing ones, we need to delete all existing annotations and import them from XFDF.
     *  - We do not want to trigger the serialization / on change microflow when importing or deleting annotations as part of the XFDF import process, otherwise we would end up in a loop. 
     *    So we need to track when annotations are created/deleted as part of the import and skip serialization in that case. There are timeouts in place to reset the tracking in case something goes wrong during import and we don't receive the expected events.
     * 
     */

    const ready = async () => {
        console.info("PDF Viewer is ready");
        const registry = await viewerRef.current?.registry;
        const documentManager = registry
            ?.getPlugin<DocumentManagerPlugin>('document-manager')
            ?.provides() as DocumentManagerPlugin;

        const annotationPlugin = registry
            ?.getPlugin<AnnotationPlugin>('annotation')
            ?.provides() as AnnotationPlugin;

        // Track when a new document is opened (import will happen after 'loaded' event)
        if (documentManager) {
            interface DocumentState {
                id: string;
                [key: string]: unknown;
            }

            documentManager.onDocumentOpened((docState: DocumentState) => {
                console.info("Document opened", docState);
                // Reset import tracking for new document
                if (hasImportedAnnotations.current !== docState.id) {
                    hasImportedAnnotations.current = null;
                }
            });
        }

        if (annotationPlugin) {
            console.info("Annotation plugin is available", annotationPlugin);
            annotationPlugin.onAnnotationEvent((event: AnnotationEvent) => {
                console.info("Annotation event", event);

                // Helper function to start/reset the import timeout
                const startImportTimeout = () => {
                    // Clear existing timeout
                    if (importTimeoutRef.current) {
                        clearTimeout(importTimeoutRef.current);
                    }
                    // Set new 30-second timeout
                    importTimeoutRef.current = setTimeout(() => {
                        if (pendingImportCount.current > 0) {
                            console.warn('Import timeout - no create event for 30 seconds, clearing count:', pendingImportCount.current);
                            pendingImportCount.current = 0;
                        }
                    }, 30000);
                };

                // Helper function to clear the import timeout
                const clearImportTimeout = () => {
                    if (importTimeoutRef.current) {
                        clearTimeout(importTimeoutRef.current);
                        importTimeoutRef.current = null;
                    }
                };

                // Helper function to serialize XFDF and trigger onChange
                const serializeAndNotify = () => {
                    if (pendingImportCount.current == 0 && pendingDeleteCount.current == 0) {
                        getAnnotationsAsXFDF(annotationPlugin, documentManager)
                        .then(xfdfString => {
                            if (xfdfRef.current?.status === "available") {
                                xfdfRef.current.setValue(xfdfString);
                                // Execute the onXfdfChange action if available
                                if (onXfdfChangeRef.current?.canExecute) {
                                    onXfdfChangeRef.current.execute();
                                }
                            }
                        })
                        .catch(error => {
                            console.error("Error getting XFDF: ", error);
                        });
                    }
                };

                // Import annotations from XFDF after the 'loaded' event (original annotations are now available)
                if (event.type === 'loaded' && xfdfRef.current?.status === 'available' && documentManager) {
                    const activeDoc = documentManager.getActiveDocument();
                    if (activeDoc && hasImportedAnnotations.current !== activeDoc.id) {
                        hasImportedAnnotations.current = activeDoc.id;
                        
                        const annotations = parseXFDF(xfdfRef.current.value || '');
                        if (annotations && annotations.length > 0) {
                            // Remove all existing annotations first
                            const state = annotationPlugin.getState();
                            if (state) {
                                const annotationsToDelete: Array<{ pageIndex: number; id: string }> = [];
                                for (const [pageIndexStr, annotationIds] of Object.entries(state.pages)) {
                                    const pageIndex = parseInt(pageIndexStr, 10);
                                    for (const id of (annotationIds as string[])) {
                                        annotationsToDelete.push({ pageIndex, id });
                                    }
                                }
                                if (annotationsToDelete.length > 0) {
                                    console.info('Removing', annotationsToDelete.length, 'existing annotations before import');
                                    pendingDeleteCount.current = annotationsToDelete.length - 1; // Set pending delete count to skip serialization during deletion
                                    annotationPlugin.deleteAnnotations(annotationsToDelete);
                                }
                            }

                            console.info('Importing annotations from XFDF:', annotations.length);
                            try {
                                // Set counter to track pending imports
                                pendingImportCount.current = annotations.length;
                                
                                const importItems = annotations.map(annot => ({
                                    annotation: annot as any
                                }));
                                annotationPlugin.importAnnotations(importItems);
                                
                                // Start 30-second timeout - will be reset by each create event
                                startImportTimeout();
                            } catch (error) {
                                pendingImportCount.current = 0;
                                console.error('Error importing annotations:', error);
                            }
                        }
                    }
                }

                if (event.type === 'delete' && event.committed && pendingDeleteCount.current > 0) {
                    pendingDeleteCount.current--;
                    return; // Skip serialization for deletions that are part of the import process
                }

                // Handle create events from imports - decrement counter
                if (event.type === 'create' && pendingImportCount.current > 0) {
                    pendingImportCount.current--;
                    if (pendingImportCount.current === 0) {
                        // All imports done, clear timeout and serialize
                        clearImportTimeout();
                    } else {
                        // Reset timeout since we received an event
                        startImportTimeout();
                    }
                    return; // Skip individual serialization for imported annotations
                }

                // Serialize to XFDF on create/update/delete (but not on initial load)
                if (event.type !== 'loaded' && xfdfRef.current) {
                    serializeAndNotify();
                }
            });
        }

    };

    // Build disabledCategories from boolean props
    // Maps widget property keys to one or more viewer category strings
    const categoryMap: Record<string, string[]> = {
        catZoom: ['zoom'],
        catZoomIn: ['zoom-in'],
        catZoomOut: ['zoom-out'],
        catZoomFitPage: ['zoom-fit-page'],
        catZoomFitWidth: ['zoom-fit-width'],
        catZoomMarquee: ['zoom-marquee'],
        catZoomLevel: ['zoom-level'],
        catAnnotation: ['annotation', 'mode-annotate'],
        catAnnotationMarkup: ['annotation-markup'],
        catAnnotationHighlight: ['annotation-highlight'],
        catAnnotationUnderline: ['annotation-underline'],
        catAnnotationStrikeout: ['annotation-strikeout'],
        catAnnotationSquiggly: ['annotation-squiggly'],
        catAnnotationInk: ['annotation-ink'],
        catAnnotationText: ['annotation-text'],
        catAnnotationStamp: ['annotation-stamp'],
        catAnnotationShape: ['annotation-shape', 'mode-shapes'],
        catAnnotationRectangle: ['annotation-rectangle'],
        catAnnotationCircle: ['annotation-circle'],
        catAnnotationLine: ['annotation-line'],
        catAnnotationArrow: ['annotation-arrow'],
        catAnnotationPolygon: ['annotation-polygon'],
        catAnnotationPolyline: ['annotation-polyline'],
        catRedaction: ['redaction', 'mode-redact'],
        catRedactionArea: ['redaction-area'],
        catRedactionText: ['redaction-text'],
        catRedactionApply: ['redaction-apply'],
        catRedactionClear: ['redaction-clear'],
        catDocument: ['document'],
        catDocumentOpen: ['document-open'],
        catDocumentClose: ['document-close'],
        catDocumentPrint: ['document-print'],
        catDocumentCapture: ['document-capture'],
        catDocumentExport: ['document-export'],
        catDocumentFullscreen: ['document-fullscreen'],
        catDocumentProtect: ['document-protect'],
        catPage: ['page'],
        catSpread: ['spread'],
        catRotate: ['rotate'],
        catScroll: ['scroll'],
        catNavigation: ['navigation'],
        catPanel: ['panel'],
        catPanelSidebar: ['panel-sidebar'],
        catPanelSearch: ['panel-search'],
        catPanelComment: ['panel-comment'],
        catTools: ['tools'],
        catPan: ['pan'],
        catPointer: ['pointer'],
        catCapture: ['capture'],
        catSelection: ['selection'],
        catSelectionCopy: ['selection-copy'],
        catHistory: ['history'],
        catHistoryUndo: ['history-undo'],
        catHistoryRedo: ['history-redo'],
    };

    const disabledCategories: string[] = [];
    for (const [propKey, categories] of Object.entries(categoryMap)) {
        if (!(props as any)[propKey]) {
            disabledCategories.push(...categories);
        }
    }
    if (!annotationsEnabled) disabledCategories.push('annotation', 'mode-annotate', 'mode-shapes');

    return (
            <div style={{height:"100vh" }} ref={containerRef}>
                <PDFViewer 
                    ref={viewerRef}
                    config={{
                        log: false,
                        src: file?.value?.uri,
                        theme: {
                            preference: props.themePreference
                        },
                        wasmUrl:  `${window.location.protocol}//${window.location.host}/pdfium.wasm`,
                        disabledCategories: disabledCategories,
                        i18n: {
                            defaultLocale: 'nl'
                        },
                        annotations: {
                            enabled: annotationsEnabled,
                            autoCommit: autoCommit,
                            annotationAuthor: annotationAuthor?.value || 'Mendix User',
                            selectAfterCreate: selectAfterCreate
                        },
                        documentManager:
                        {
                            maxDocuments: 1
                        }
                    }}
                    style={{ width: '100%', height: '100%' }}
                    onReady={ready}
                />
            </div>
        );
}
