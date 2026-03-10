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
    const pendingImportCount = useRef(0); // Count of annotations being imported
    const importTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for import completion
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
        const documentManager = registry
            ?.getPlugin<DocumentManagerPlugin>('document-manager')
            ?.provides() as DocumentManagerPlugin;

        const annotationPlugin = registry
            ?.getPlugin<AnnotationPlugin>('annotation')
            ?.provides() as AnnotationPlugin;

        // Track when a new document is opened (import will happen after 'loaded' event)
        if (documentManager) {
            documentManager.onDocumentOpened((docState) => {
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
                    if (pendingImportCount.current == 0) { 
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
                        
                        const annotations = parseXFDF(xfdfRef.current.value);
                        if (annotations && annotations.length > 0) {
                            // Get existing annotation IDs to avoid duplicates
                            const state = annotationPlugin.getState();
                            const existingIds = new Set<string>();
                            for (const uids of Object.values(state.pages)) {
                                for (const uid of uids) {
                                    const tracked = state.byUid[uid];
                                    if (tracked?.object?.id) {
                                        existingIds.add(tracked.object.id);
                                    }
                                }
                            }
                            
                            // Filter out annotations that already exist in the document
                            const newAnnotations = annotations.filter(annot => !existingIds.has(annot.id));
                            
                            if (newAnnotations.length > 0) {
                                console.info('Importing annotations from XFDF:', newAnnotations.length, 'new of', annotations.length, 'total');
                                try {
                                    // Set counter to track pending imports
                                    pendingImportCount.current = newAnnotations.length;
                                    
                                    const importItems = newAnnotations.map(annot => ({
                                        annotation: annot as any
                                    }));
                                    annotationPlugin.importAnnotations(importItems);
                                    
                                    // Start 30-second timeout - will be reset by each create event
                                    startImportTimeout();
                                } catch (error) {
                                    pendingImportCount.current = 0;
                                    console.error('Error importing annotations:', error);
                                }
                            } else {
                                console.info('All annotations from XFDF already exist in document');
                            }
                        }
                    }
                }

                // Handle create events from imports - decrement counter
                if (event.type === 'create' && pendingImportCount.current > 0) {
                    pendingImportCount.current--;
                    console.info('Import event received, remaining:', pendingImportCount.current);
                    
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
