'use client'

import { ReactElement, createElement, useCallback, useEffect, useRef } from "react";
import { EmbedPDFContainerProps } from "../typings/EmbedPDFProps";
import { Big } from "big.js";
import { PDFViewerRef, PDFViewer, AnnotationPlugin, 
    ScrollEvent, DocumentManagerPlugin, ScrollPlugin, AnnotationEvent } from "@embedpdf/react-pdf-viewer";

import "./ui/EmbedPDF.css";
import { getAnnotationsAsXFDF, parseXFDF } from "./utils/xfdf";

export function EmbedPDF({ file, activePage, xfdf, onXfdfChange }: EmbedPDFContainerProps): ReactElement {

    const viewerRef = useRef<PDFViewerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const xfdfRef = useRef(xfdf);
    const onXfdfChangeRef = useRef(onXfdfChange);
    const hasImportedAnnotations = useRef<string | null>(null); // Track which document we've imported for
    const currentDocumentGuid = useRef<string | null>(null); // Track currently opened document GUID
    let listeningToPageChanges = false;

    // Extract GUID from file URL
    const getGuidFromUrl = (url: string): string | null => {
        const match = url.match(/[?&]guid=([^&]+)/);
        return match ? match[1] : null;
    };

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

    const ready = async () => {
        console.info("PDF Viewer is ready");
        const registry = await viewerRef.current?.registry;
        console.info("Registry: ", registry);

        const documentManager = registry
            ?.getPlugin<DocumentManagerPlugin>('document-manager')
            ?.provides() as DocumentManagerPlugin;

        const annotationPlugin = registry
            ?.getPlugin<AnnotationPlugin>('annotation')
            ?.provides() as AnnotationPlugin;

        // Import annotations from XFDF when document is opened
        if (documentManager) {
            documentManager.onDocumentOpened((docState) => {
                console.info("Document opened", docState);
                if (xfdfRef.current?.status === 'available' && annotationPlugin) {
                    // Only import once per document
                    if (hasImportedAnnotations.current !== docState.id) {
                        hasImportedAnnotations.current = docState.id;
                        
                        // First, clear all existing annotations from the loaded document
                        const state = annotationPlugin.getState();
                        const annotationsToDelete: { pageIndex: number; id: string }[] = [];
                        for (const [pageIndex, uids] of Object.entries(state.pages)) {
                            for (const uid of uids) {
                                const tracked = state.byUid[uid];
                                if (tracked?.object) {
                                    annotationsToDelete.push({
                                        pageIndex: Number(pageIndex),
                                        id: tracked.object.id
                                    });
                                }
                            }
                        }
                        
                        if (annotationsToDelete.length > 0) {
                            console.info('Removing existing annotations:', annotationsToDelete.length);
                            annotationPlugin.deleteAnnotations(annotationsToDelete);
                        }
                        
                        // Then import annotations from XFDF
                        const annotations = parseXFDF(xfdfRef.current.value);
                        if (annotations && annotations.length > 0) {
                            console.info('Importing annotations from XFDF:', annotations);
                            try {
                                const importItems = annotations.map(annot => ({
                                    annotation: annot as any
                                }));
                                annotationPlugin.importAnnotations(importItems);
                            } catch (error) {
                                console.error('Error importing annotations:', error);
                            }
                        }
                    }
                }
            });
        }

        if (annotationPlugin) {
            console.info("Annotation plugin is available", annotationPlugin);
            annotationPlugin.onAnnotationEvent((event: AnnotationEvent) => {
                console.info("Annotation event", event);

                // Serialize to XFDF on create/update/delete (but not on initial load)
                if (event.type !== 'loaded' && xfdfRef.current) {
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

                
                const state = annotationPlugin.getState(); 

                /* console.info(documentManager);
                const doc = documentManager?.getActiveDocument(); 
                console.info("Active documentje ", doc); */
                //debugger;
                //const annotation = await annotationPlugin.getAnnotations(doc).toPromise();
                //console.info("Annotations: ", annotation);
                /* for (let i = 0; i < doc.pages.length; i++) {
                    console.info(`Annotations for page ${i}`, annotationPlugin.getPageAnnotations(i));
                } */
                
                /* engine?.getAllAnnotations().then(annotations => {
                    console.info("All annotations", annotations);
                }); */
            });
        }

    };

    return (
            <div style={{height:"100vh" }} ref={containerRef}>
                <PDFViewer 
                    ref={viewerRef}
                    config={{
                        log: false,
                        src: file?.value?.uri,
                        theme: {
                            preference: 'dark'  // 'light' | 'dark' | 'system'
                        },
                        wasmUrl:  `${window.location.protocol}//${window.location.host}/pdfium.wasm`,
                        disabledCategories: ['download', 'print', 'export'],
                        i18n: {
                            defaultLocale: 'nl'
                        },
                        annotations: {
                            enabled: true,
                            autoCommit: true,
                            annotationAuthor: 'Mendix User',
                            selectAfterCreate: true
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
