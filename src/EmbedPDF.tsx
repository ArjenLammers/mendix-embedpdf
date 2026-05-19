"use client";

import { ReactElement, createElement, useEffect, useRef } from "react";
import { EmbedPDFContainerProps } from "../typings/EmbedPDFProps";
import { Big } from "big.js";
import {
    PDFViewerRef,
    PDFViewer,
    AnnotationPlugin,
    ScrollEvent,
    DocumentManagerPlugin,
    ScrollPlugin,
    AnnotationEvent,
    UIPlugin
} from "@embedpdf/react-pdf-viewer";

import "./ui/EmbedPDF.css";
import { getAnnotationsAsXFDF, parseXFDF } from "./utils/xfdf";
import { getGuidFromUrl, resolveUri } from "./utils/url";
import { getDisabledCategories } from "./utils/categories";

declare const __EMBEDPDF_BUILD__: string | undefined;

export function EmbedPDF(props: EmbedPDFContainerProps): ReactElement {
    const {
        file,
        activePage,
        xfdf,
        onXfdfChange,
        annotationsEnabled,
        autoCommit,
        annotationAuthor,
        selectAfterCreate
    } = props;

    const viewerRef = useRef<PDFViewerRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const xfdfRef = useRef(xfdf);
    const onXfdfChangeRef = useRef(onXfdfChange);
    const hasImportedAnnotations = useRef<string | null>(null); // Track which document we've imported for
    const currentDocumentGuid = useRef<string | null>(null); // Track currently opened document GUID
    const pendingImportCount = useRef(0); // Count of annotations being imported
    const pendingDeleteCount = useRef(0); // Count of annotations being deleted
    const importTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Timeout for import completion
    const listeningToPageChanges = useRef(false);

    // Keep refs in sync with props
    useEffect(() => {
        xfdfRef.current = xfdf;
    }, [xfdf]);

    useEffect(() => {
        onXfdfChangeRef.current = onXfdfChange;
    }, [onXfdfChange]);

    useEffect(() => {
        const sync = async (): Promise<void> => {
            const registry = await viewerRef.current?.registry;
            const docManager = registry
                ?.getPlugin<DocumentManagerPlugin>("document-manager")
                ?.provides() as DocumentManagerPlugin;
            const uri = await resolveUri(file?.value?.uri);
            console.info("File prop changed, URI:", uri);

            const fileGuid = uri ? getGuidFromUrl(uri) : null;
            if (uri && fileGuid && fileGuid !== currentDocumentGuid.current) {
                console.info("Opening document", uri, "GUID:", fileGuid);
                currentDocumentGuid.current = fileGuid;
                // Reset import tracking when opening a new document
                hasImportedAnnotations.current = null;
                await docManager.closeAllDocuments().toPromise();
                docManager.openDocumentUrl({
                    url: uri,
                    autoActivate: true
                });
            }
        };
        sync();
    }, [file]);

    /**
     * Scroll the viewer to the active page when it changes.
     */
    useEffect(() => {
        if (activePage?.status === "available") {
            const sync = async (): Promise<void> => {
                const registry = await viewerRef.current?.registry;
                const docManager = registry
                    ?.getPlugin<DocumentManagerPlugin>("document-manager")
                    ?.provides() as DocumentManagerPlugin;
                const activeDoc = docManager?.getActiveDocument();
                if (!activeDoc) {
                    return; // No active document yet, skip scrolling
                }
                const scrollPlugin = registry?.getPlugin<ScrollPlugin>("scroll")?.provides() as ScrollPlugin;
                if (!scrollPlugin) {
                    return;
                }
                scrollPlugin.scrollToPage({
                    pageNumber: activePage.value?.toNumber() || 0,
                    behavior: "smooth"
                });
            };
            sync();
        }
    }, [activePage]);

    /**
     * To explain dark magic in here, there are some design decisions to keep into account:
     *  - A PDF document can contain annotations itself. When we haven't got XFDF contents yet, we keep this in place. On the next change, they should all be serialized and contained into the XFDF.
     *  - When a PDF document contains annotations, their ID will be re-generated when imported by the PDF viewer. This means we can't combine the XFDF annotations with the existing ones, we need to delete all existing annotations and import them from XFDF.
     *  - We do not want to trigger the serialization / on change microflow when importing or deleting annotations as part of the XFDF import process, otherwise we would end up in a loop.
     *    So we need to track when annotations are created/deleted as part of the import and skip serialization in that case. There are timeouts in place to reset the tracking in case something goes wrong during import and we don't receive the expected events.
     *
     */

    const ready = async (): Promise<void> => {
        console.info(`EmbedPDF build: ${typeof __EMBEDPDF_BUILD__ !== "undefined" ? __EMBEDPDF_BUILD__ : "dev"}`);
        console.info("PDF Viewer is ready");
        const registry = await viewerRef.current?.registry;
        const documentManager = registry
            ?.getPlugin<DocumentManagerPlugin>("document-manager")
            ?.provides() as DocumentManagerPlugin;

        const annotationPlugin = registry?.getPlugin<AnnotationPlugin>("annotation")?.provides() as AnnotationPlugin;

        // Hide callout button by removing it from the UI schema
        // (callout shares the "annotation-text" category with Text, so disabledCategories can't target it alone)
        // removeFromSchema doesn't filter items inside groups, so we do a deep filter here.
        if (!props.catAnnotationCallout) {
            const uiPlugin = registry?.getPlugin<UIPlugin>("ui")?.provides();
            if (uiPlugin) {
                const schema = uiPlugin.getSchema();
                const commandId = "annotation:add-callout";

                const filterItems = (items: any[]): any[] =>
                    items
                        .map(item => {
                            if (item.type === "group" && item.items) {
                                return { ...item, items: item.items.filter((c: any) => c.commandId !== commandId) };
                            }
                            if (item.type === "section" && item.items) {
                                return { ...item, items: item.items.filter((c: any) => c.commandId !== commandId) };
                            }
                            return item;
                        })
                        .filter(item => {
                            if (
                                (item.type === "command-button" || item.type === "command") &&
                                item.commandId === commandId
                            ) {
                                return false;
                            }
                            return true;
                        });

                const toolbars: Record<string, any> = {};
                for (const [id, toolbar] of Object.entries(schema.toolbars)) {
                    toolbars[id] = { ...(toolbar as any), items: filterItems((toolbar as any).items) };
                }
                const menus: Record<string, any> = {};
                for (const [id, menu] of Object.entries(schema.menus)) {
                    menus[id] = { ...(menu as any), items: filterItems((menu as any).items) };
                }
                uiPlugin.mergeSchema({ toolbars, menus } as any);
            }
        }

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
                console.debug("Annotation event", event);

                // Helper function to start/reset the import timeout
                const startImportTimeout = (): void => {
                    // Clear existing timeout
                    if (importTimeoutRef.current) {
                        clearTimeout(importTimeoutRef.current);
                    }
                    // Set new 30-second timeout
                    importTimeoutRef.current = setTimeout(() => {
                        if (pendingImportCount.current > 0) {
                            console.warn(
                                "Import timeout - no create event for 30 seconds, clearing count:",
                                pendingImportCount.current
                            );
                            pendingImportCount.current = 0;
                        }
                    }, 30000);
                };

                // Helper function to clear the import timeout
                const clearImportTimeout = (): void => {
                    if (importTimeoutRef.current) {
                        clearTimeout(importTimeoutRef.current);
                        importTimeoutRef.current = null;
                    }
                };

                // Helper function to serialize XFDF and trigger onChange
                const serializeAndNotify = (): void => {
                    if (pendingImportCount.current === 0 && pendingDeleteCount.current === 0) {
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
                if (event.type === "loaded" && xfdfRef.current?.status === "available" && documentManager) {
                    const activeDoc = documentManager.getActiveDocument();
                    if (activeDoc && hasImportedAnnotations.current !== activeDoc.id) {
                        hasImportedAnnotations.current = activeDoc.id;

                        const importPageSizes: Record<number, { width: number; height: number }> = {};
                        for (const pg of activeDoc.pages) {
                            importPageSizes[pg.index] = {
                                width: pg.size.width,
                                height: pg.size.height
                            };
                        }
                        const annotations = parseXFDF(xfdfRef.current.value || "", importPageSizes);
                        if (annotations && annotations.length > 0) {
                            // Remove all existing annotations first
                            const state = annotationPlugin.getState();
                            if (state) {
                                const annotationsToDelete: Array<{ pageIndex: number; id: string }> = [];
                                for (const [pageIndexStr, annotationIds] of Object.entries(state.pages)) {
                                    const pageIndex = parseInt(pageIndexStr, 10);
                                    for (const id of annotationIds as string[]) {
                                        annotationsToDelete.push({ pageIndex, id });
                                    }
                                }
                                if (annotationsToDelete.length > 0) {
                                    console.info(
                                        "Removing",
                                        annotationsToDelete.length,
                                        "existing annotations before import"
                                    );
                                    pendingDeleteCount.current = annotationsToDelete.length - 1; // Set pending delete count to skip serialization during deletion
                                    annotationPlugin.deleteAnnotations(annotationsToDelete);
                                }
                            }

                            console.info("Importing annotations from XFDF:", annotations);
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
                                console.error("Error importing annotations:", error);
                            }
                        }
                    }
                }

                if (event.type === "delete" && event.committed && pendingDeleteCount.current > 0) {
                    pendingDeleteCount.current--;
                    return; // Skip serialization for deletions that are part of the import process
                }

                // Handle create events from imports - decrement counter
                if (event.type === "create" && pendingImportCount.current > 0) {
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
                if (event.type !== "loaded" && xfdfRef.current) {
                    serializeAndNotify();
                }
            });
        }

        /**
         * Set the value of the Mendix object of the active page when the page is changed in the viewer.
         * We only set this up once to avoid multiple event handlers being registered,
         * which would cause multiple updates and potentially performance issues.
         */
        if (!listeningToPageChanges.current && activePage) {
            const sync = async (): Promise<void> => {
                const registry = await viewerRef.current?.registry;
                const scrollPlugin = registry?.getPlugin<ScrollPlugin>("scroll")?.provides() as ScrollPlugin;
                scrollPlugin.onPageChange((event: ScrollEvent) => {
                    activePage.setValue(new Big(event.pageNumber));
                });
                listeningToPageChanges.current = true;
            };
            sync();
        }
    };

    const disabledCategories = getDisabledCategories(props);
    const effectiveAnnotationsEnabled = props.readOnly ? false : annotationsEnabled;

    const viewerReady =
        (!annotationAuthor || annotationAuthor.status === "available") &&
        (!activePage || activePage.status === "available");

    return (
        <div style={{ height: "100vh" }} ref={containerRef}>
            {viewerReady && (
                <PDFViewer
                    ref={viewerRef}
                    config={{
                        log: false,
                        src: typeof file?.value?.uri === "string" ? file.value.uri : undefined,
                        theme: {
                            preference: props.themePreference
                        },
                        wasmUrl: `${window.location.protocol}//${window.location.host}/pdfium.wasm`,
                        disabledCategories,
                        i18n: {
                            defaultLocale: "nl"
                        },
                        annotations: {
                            enabled: effectiveAnnotationsEnabled,
                            autoCommit,
                            annotationAuthor: annotationAuthor?.value || "Mendix User",
                            selectAfterCreate
                        },
                        documentManager: {
                            maxDocuments: 1
                        },
                        permissions: {
                            overrides: {
                                print: !props.catDocumentPrint,
                                modifyAnnotations: !props.readOnly
                            }
                        }
                    }}
                    style={{ width: "100%", height: "100%" }}
                    onReady={ready}
                />
            )}
        </div>
    );
}
