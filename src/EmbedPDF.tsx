'use client'

import { ReactElement, createElement, useCallback, useEffect, useRef } from "react";
import { EmbedPDFContainerProps } from "../typings/EmbedPDFProps";
import { Big } from "big.js";
import { PDFViewerRef, PDFViewer, AnnotationPlugin, 
    ScrollEvent, DocumentManagerPlugin, ScrollPlugin, AnnotationEvent } from "@embedpdf/react-pdf-viewer";

import "./ui/EmbedPDF.css";

export function EmbedPDF({ file, activePage }: EmbedPDFContainerProps): ReactElement {

    const viewerRef = useRef<PDFViewerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    let listeningToPageChanges = false;

    useEffect(() => {
        console.info("Use effect");
    }, []);

    useEffect(() => {
        console.info("File changed", file);
        const sync = async () => {
            const registry = await viewerRef.current?.registry;
            const docManager = registry
                ?.getPlugin<DocumentManagerPlugin>('document-manager')
                ?.provides() as DocumentManagerPlugin;
            if (file?.value?.uri) {
                console.info("Opening document", file.value.uri);
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
        console.info("PDF Viewer is ready", viewerRef);
        const registry = await viewerRef.current?.registry;
        
        const annotationPlugin = registry
            ?.getPlugin<AnnotationPlugin>('annotation')
            ?.provides() as AnnotationPlugin;
        if (annotationPlugin) {
            console.info("Annotation plugin is available", annotationPlugin, annotationPlugin.getState());
            annotationPlugin.onAnnotationEvent(async (event: AnnotationEvent) => {
                console.info("Annotation event", event);
                
                /* const engine = registry?.getEngine();
                console.info("Plugin: ", annotationPlugin);
                const state = annotationPlugin.getState(); */

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
