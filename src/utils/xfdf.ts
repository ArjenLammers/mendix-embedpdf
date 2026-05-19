import { AnnotationPlugin, DocumentManagerPlugin, type AnnotationTransferItem } from "@embedpdf/react-pdf-viewer";

export interface Annotation {
    id: string;
    type: number;
    page?: number;
    pageIndex?: number;
    rect: { origin: { x: number; y: number }; size: { width: number; height: number } };
    color?: string;
    strokeColor?: string;
    contents?: string;
    author?: string;
    created?: Date;
    modified?: Date;
    opacity?: number;
    custom?: Record<string, unknown>;
    segmentRects?: Array<{ origin: { x: number; y: number }; size: { width: number; height: number } }>;
    inReplyToId?: string;
    flags?: string[];
    icon?: string;
    fontSize?: number;
    fontColor?: string;
    fontFamily?: number;
    textAlign?: number;
    verticalAlign?: number;
    rotation?: number;
    unrotatedRect?: { origin: { x: number; y: number }; size: { width: number; height: number } };
    backgroundColor?: string;
    intent?: string;
    calloutLine?: Array<{ x: number; y: number }>;
    lineEnding?: string;
    strokeWidth?: number;
    [key: string]: unknown;
}

// PDF annotation type codes to XFDF tag names (from PdfAnnotationSubtype enum)
const annotationTypeCodeMap: Record<number, string> = {
    0: "text", // UNKNOWN - fallback to text
    1: "text", // TEXT (sticky note)
    2: "link", // LINK
    3: "freetext", // FREETEXT
    4: "line", // LINE
    5: "square", // SQUARE
    6: "circle", // CIRCLE
    7: "polygon", // POLYGON
    8: "polyline", // POLYLINE
    9: "highlight", // HIGHLIGHT
    10: "underline", // UNDERLINE
    11: "squiggly", // SQUIGGLY
    12: "strikeout", // STRIKEOUT
    13: "stamp", // STAMP
    14: "caret", // CARET
    15: "ink", // INK
    16: "popup", // POPUP
    17: "fileattachment", // FILEATTACHMENT
    18: "sound", // SOUND
    19: "movie", // MOVIE
    20: "widget", // WIDGET
    21: "screen", // SCREEN
    22: "printermark", // PRINTERMARK
    23: "trapnet", // TRAPNET
    24: "watermark", // WATERMARK
    25: "3d", // 3D
    26: "redact" // REDACT
};

// Reverse mapping: XFDF tag name to type code
const xfdfTagToTypeCode: Record<string, number> = {
    text: 1,
    link: 2,
    freetext: 3,
    line: 4,
    square: 5,
    circle: 6,
    polygon: 7,
    polyline: 8,
    highlight: 9,
    underline: 10,
    squiggly: 11,
    strikeout: 12,
    stamp: 13,
    caret: 14,
    ink: 15,
    popup: 16,
    fileattachment: 17,
    sound: 18,
    movie: 19,
    widget: 20,
    screen: 21,
    printermark: 22,
    trapnet: 23,
    watermark: 24,
    "3d": 25,
    redact: 26
};

// PdfStandardFont enum values to PDF base font names
const pdfStandardFontNames: Record<number, string> = {
    0: "Courier",
    1: "Courier-Bold",
    2: "Courier-BoldOblique",
    3: "Courier-Oblique",
    4: "Helvetica",
    5: "Helvetica-Bold",
    6: "Helvetica-BoldOblique",
    7: "Helvetica-Oblique",
    8: "Times-Roman",
    9: "Times-Bold",
    10: "Times-BoldItalic",
    11: "Times-Italic",
    12: "Symbol",
    13: "ZapfDingbats"
};

// Reverse: PDF font name (lowercase) to PdfStandardFont enum value
const pdfFontNameToCode: Record<string, number> = Object.fromEntries(
    Object.entries(pdfStandardFontNames).map(([code, name]) => [name.toLowerCase(), parseInt(code, 10)])
);

function hexToRgbFloats(hex: string): [number, number, number] | null {
    const match = hex.match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
        return null;
    }
    return [
        parseInt(match[1].substring(0, 2), 16) / 255,
        parseInt(match[1].substring(2, 4), 16) / 255,
        parseInt(match[1].substring(4, 6), 16) / 255
    ];
}

function rgbFloatsToHex(r: number, g: number, b: number): string {
    const toHex = (v: number) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function annotationsToXFDF(
    annotations: Annotation[],
    documentId?: string,
    pageSizes?: Record<number, { width: number; height: number }>
): string {
    const escapeXml = (str: string): string => {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    };

    const formatDate = (date?: Date): string => {
        if (!date) {
            return "";
        }
        return `D:${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(
            2,
            "0"
        )}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(
            date.getSeconds()
        ).padStart(2, "0")}`;
    };

    const getRectString = (rect: Annotation["rect"], pageHeight?: number, annotationType?: number): string => {
        if (!rect?.origin || !rect?.size) {
            return "0,0,0,0";
        }
        const { x, y } = rect.origin;
        const { width, height } = rect.size;
        
        // For FreeText and other annotations, convert from device coords (y-down) to PDF user space (y-up)
        const isFreeText = annotationType === 3;
        if (isFreeText && pageHeight !== undefined) {
            // In PDF space (y-up): y1 is bottom, y2 is top
            const y1 = pageHeight - (y + height);  // bottom in PDF space
            const y2 = pageHeight - y;              // top in PDF space
            return `${x},${y1},${x + width},${y2}`;
        }
        
        // For other annotation types without pageHeight, use original coordinates
        return `${x},${y},${x + width},${y + height}`;
    };

    let xfdf = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xfdf += '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n';

    if (documentId) {
        xfdf += `  <f href="${escapeXml(documentId)}"/>\n`;
    }

    xfdf += "  <annots>\n";

    for (const annot of annotations) {
        if (!annot) {
            continue;
        }

        const tagName = annotationTypeCodeMap[annot.type] || "text";
        const pageNum = annot.page ?? annot.pageIndex ?? 0;
        const pageHeight = pageSizes?.[pageNum]?.height;
        const rect = getRectString(annot.rect, pageHeight, annot.type);

        xfdf += `    <${tagName}`;
        xfdf += ` page="${pageNum}"`;
        xfdf += ` rect="${rect}"`;
        if (annot.id) {
            xfdf += ` name="${escapeXml(String(annot.id))}"`;
        }

        const isFreeText = tagName === "freetext";

        if (!isFreeText) {
            if (annot.color) {
                xfdf += ` color="${escapeXml(String(annot.color))}"`;
            }
            if (annot.strokeColor) {
                xfdf += ` stroke-color="${escapeXml(String(annot.strokeColor))}"`;
            }
        }
        if (annot.author) {
            xfdf += ` title="${escapeXml(String(annot.author))}"`;
        }
        if (annot.created) {
            xfdf += ` creationdate="${formatDate(annot.created)}"`;
        }
        if (annot.modified) {
            xfdf += ` date="${formatDate(annot.modified)}"`;
        }
        if (annot.opacity !== undefined) {
            xfdf += ` opacity="${annot.opacity}"`;
        }
        if (annot.inReplyToId) {
            xfdf += ` inreplyto="${escapeXml(String(annot.inReplyToId))}"`;
        }
        if (annot.icon) {
            xfdf += ` icon="${escapeXml(String(annot.icon))}"`;
        }
        if (annot.flags && annot.flags.length > 0) {
            xfdf += ` flags="${annot.flags.join(",")}"`;
        }

        // FreeText-specific attributes
        if (isFreeText) {
            // XFDF color = border/stroke for freetext.
            // PDFBox derives the border color from the DA string's rg color if /C is not
            // explicitly set. Always emit an explicit color to prevent this: use the real
            // border color when a border is intended, otherwise white to force a transparent-
            // looking border that won't show the font color.
            const hasBorder = annot.strokeWidth !== undefined && annot.strokeWidth > 0;
            const borderColor = annot.strokeColor && annot.strokeColor !== "transparent"
                ? annot.strokeColor
                : undefined;
            if (hasBorder && borderColor && borderColor.toLowerCase() !== annot.fontColor?.toLowerCase()) {
                xfdf += ` color="${escapeXml(String(borderColor))}"`;
            }

            // interior-color = background/fill
            const bgColor =
                annot.backgroundColor && annot.backgroundColor !== "transparent"
                    ? annot.backgroundColor
                    : annot.color && annot.color !== "transparent" && annot.color.toLowerCase() !== annot.fontColor?.toLowerCase()
                    ? annot.color
                    : undefined;
            if (bgColor) {
                xfdf += ` interior-color="${escapeXml(String(bgColor))}"`;
            }
            if (annot.rotation !== undefined && annot.rotation !== 0) {
                xfdf += ` rotation="${annot.rotation}"`;
            }
            if (annot.textAlign !== undefined) {
                xfdf += ` justification="${annot.textAlign}"`;
            }
            if (annot.intent) {
                xfdf += ` intent="${escapeXml(String(annot.intent))}"`;
            }
            if (annot.calloutLine && Array.isArray(annot.calloutLine) && annot.calloutLine.length > 0) {
                const pts = annot.calloutLine.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(",");
                xfdf += ` callout="${pts}"`;
            }
            if (annot.lineEnding) {
                xfdf += ` head="${escapeXml(String(annot.lineEnding))}"`;
            }
            // Always emit width; default to 0 (no border) when not explicitly set
            xfdf += ` width="${annot.strokeWidth !== undefined && annot.strokeWidth > 0 ? annot.strokeWidth : 0}"`;
        }

        // Text markup annotations need coords attribute per XFDF spec
        const textMarkupTypes = [9, 10, 11, 12]; // HIGHLIGHT, UNDERLINE, SQUIGGLY, STRIKEOUT
        const isTextMarkup = textMarkupTypes.includes(annot.type);
        if (isTextMarkup && annot.segmentRects && annot.segmentRects.length > 0) {
            // coords contains 8*n values: four (x,y) pairs per quadrilateral
            // Order per spec: x1,y1 (upper-left), x2,y2 (upper-right), x3,y3 (lower-left), x4,y4 (lower-right)
            const coordValues = annot.segmentRects
                .map(r => {
                    const x1 = r.origin.x;
                    const x2 = x1 + r.size.width;
                    let yTop: number;
                    let yBot: number;
                    if (pageHeight !== undefined) {
                        // Convert from device coords (y-down) to PDF user space (y-up)
                        yTop = pageHeight - r.origin.y;
                        yBot = pageHeight - (r.origin.y + r.size.height);
                    } else {
                        yTop = r.origin.y + r.size.height;
                        yBot = r.origin.y;
                    }
                    return `${x1},${yTop},${x2},${yTop},${x1},${yBot},${x2},${yBot}`;
                })
                .join(",");
            xfdf += ` coords="${coordValues}"`;
        }

        // Build child elements
        let childContent = "";

        if (isFreeText) {
            // <defaultappearance> with DA string: /FontName size Tf r g b rg
            const fontName = pdfStandardFontNames[annot.fontFamily as number] ?? "Helvetica";
            const fontSize = annot.fontSize ?? 12;
            let daStr = `/${fontName} ${fontSize} Tf`;
            if (annot.fontColor && typeof annot.fontColor === "string") {
                const rgb = hexToRgbFloats(annot.fontColor);
                if (rgb) {
                    daStr += ` ${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg`;
                }
            }
            childContent += `      <defaultappearance>${escapeXml(daStr)}</defaultappearance>\n`;
            // <defaultstyle> maps to /DS — Adobe Reader uses this for text styling
            const dsFontFamily = fontName.replace("-", ",") + ",sans-serif";
            const dsColor = annot.fontColor || "#000000";
            const dsAlign = annot.textAlign === 1 ? "center" : annot.textAlign === 2 ? "right" : "left";
            let dsStr = `font: ${dsFontFamily} ${fontSize}.0pt; text-align:${dsAlign}; color:${dsColor}`;
            if (annot.verticalAlign !== undefined) {
                dsStr += `; vertical-align:${annot.verticalAlign}`;
            }
            childContent += `      <defaultstyle>${escapeXml(dsStr)}</defaultstyle>\n`;
            // <body> rich text maps to /RC — Adobe Reader uses this to render text
            const rcColor = dsColor;
            const rcFontFamily = fontName;
            const rcContents = annot.contents ? escapeXml(String(annot.contents)) : "";
            childContent += `      <body xmlns="http://www.w3.org/1999/xhtml" xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:spec="2.0.2" style="font-size:${fontSize}.0pt;text-align:${dsAlign};color:${rcColor};font-weight:normal;font-style:normal;font-family:${rcFontFamily},sans-serif;font-stretch:normal"><p dir="ltr"><span style="font-family:${rcFontFamily};color:${rcColor}">${rcContents}</span></p></body>\n`;
        }

        if (annot.contents) {
            childContent += `      <contents>${escapeXml(String(annot.contents))}</contents>\n`;
        }

        if (childContent) {
            xfdf += ">\n";
            xfdf += childContent;
            xfdf += `    </${tagName}>\n`;
        } else {
            xfdf += "/>\n";
        }
    }

    xfdf += "  </annots>\n";
    xfdf += "</xfdf>";

    return xfdf;
}

export async function getAnnotationsAsXFDF(
    annotationPlugin: AnnotationPlugin,
    documentManager: DocumentManagerPlugin
): Promise<string> {
    const activeDoc = documentManager.getActiveDocument();
    if (!activeDoc) {
        throw new Error("No active document");
    }

    // Build page size lookup from document pages
    const pageSizes: Record<number, { width: number; height: number }> = {};
    for (const page of activeDoc.pages) {
        pageSizes[page.index] = { width: page.size.width, height: page.size.height };
    }

    // Use the documented exportAnnotations() API
    const items = await new Promise<AnnotationTransferItem[]>((resolve, reject) => {
        annotationPlugin.exportAnnotations().wait(
            (exportedItems: AnnotationTransferItem[]) => resolve(exportedItems),
            (error: unknown) => reject(error)
        );
    });

    const allAnnotations: Annotation[] = items.map(item => {
        const annot = item.annotation as any;
        return {
            ...annot,
            page: annot.pageIndex ?? annot.page ?? 0
        } as Annotation;
    });

    return annotationsToXFDF(allAnnotations, activeDoc.id, pageSizes);
}

/**
 * Parse XFDF string and return annotation objects that can be imported
 */
export function parseXFDF(
    xfdfString: string,
    pageSizes?: Record<number, { width: number; height: number }>
): Annotation[] {
    const annotations: Annotation[] = [];

    if (!xfdfString || xfdfString.trim() === "") {
        return annotations;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xfdfString, "text/xml");

    // Check for parse errors
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
        console.error("XFDF parse error:", parseError.textContent);
        return annotations;
    }

    const annots = doc.querySelector("annots");
    if (!annots) {
        return annotations;
    }

    const unescapeXml = (str: string): string => {
        return str
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    };

    const parseDate = (dateStr: string): Date | undefined => {
        if (!dateStr) {
            return undefined;
        }
        // Format: D:YYYYMMDDHHmmss
        const match = dateStr.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (match) {
            const [, year, month, day, hour, minute, second] = match;
            return new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hour, 10),
                parseInt(minute, 10),
                parseInt(second, 10)
            );
        }
        return undefined;
    };

    const parseRect = (rectStr: string, pageHeight?: number, isFreeText?: boolean): Annotation["rect"] => {
        const parts = rectStr.split(",").map(Number);
        if (parts.length !== 4) {
            return { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } };
        }
        const [x1, y1, x2, y2] = parts;
        
        // For FreeText annotations, convert from PDF coords (y-up) back to device coords (y-down)
        if (isFreeText && pageHeight !== undefined) {
            // In PDF space: y1 is bottom, y2 is top
            // Convert back to device coords (y-down)
            const yBottom = y1;  // bottom in PDF space
            const yTop = y2;     // top in PDF space
            const yOrigin = pageHeight - yTop;    // top in device coords
            const ySize = yTop - yBottom;        // height
            return {
                origin: { x: x1, y: yOrigin },
                size: { width: x2 - x1, height: ySize }
            };
        }
        
        // For other annotation types, use original parsing
        return {
            origin: { x: x1, y: y1 },
            size: { width: x2 - x1, height: y2 - y1 }
        };
    };

    // Iterate through all annotation elements
    for (const child of Array.from(annots.children)) {
        const tagName = child.tagName.toLowerCase();
        const typeCode = xfdfTagToTypeCode[tagName];

        if (typeCode === undefined) {
            console.warn(`Unknown XFDF annotation type: ${tagName}`);
            continue;
        }

        const annotation: Annotation = {
            id: child.getAttribute("name") || crypto.randomUUID(),
            type: typeCode,
            page: parseInt(child.getAttribute("page") || "0", 10),
            pageIndex: parseInt(child.getAttribute("page") || "0", 10),
            rect: parseRect(child.getAttribute("rect") || "0,0,0,0", pageSizes?.[parseInt(child.getAttribute("page") || "0", 10)]?.height, typeCode === 3)
        };

        // Text markup annotations (highlight, underline, squiggly, strikeout) require segmentRects
        const textMarkupTypes = [9, 10, 11, 12]; // HIGHLIGHT, UNDERLINE, SQUIGGLY, STRIKEOUT
        if (textMarkupTypes.includes(typeCode)) {
            // Try to read coords attribute first (XFDF spec), then fall back to segment-rects element
            const coordsAttr = child.getAttribute("coords");
            if (coordsAttr) {
                const values = coordsAttr.split(",").map(Number);
                const quads: Annotation["segmentRects"] = [];
                const pH = pageSizes?.[annotation.page!]?.height;
                // Each quad is 8 values: x1,y1 (upper-left), x2,y2 (upper-right), x3,y3 (lower-left), x4,y4 (lower-right)
                for (let i = 0; i + 7 < values.length; i += 8) {
                    const x1 = values[i];
                    const y1 = values[i + 1];
                    const x2 = values[i + 2];
                    const y2 = values[i + 3];
                    const x3 = values[i + 4];
                    const y3 = values[i + 5];
                    const x4 = values[i + 6];
                    const y4 = values[i + 7];
                    const minX = Math.min(x1, x2, x3, x4);
                    const minY = Math.min(y1, y2, y3, y4);
                    const maxX = Math.max(x1, x2, x3, x4);
                    const maxY = Math.max(y1, y2, y3, y4);
                    if (pH !== undefined) {
                        // Reverse y-flip: convert from PDF space (y-up) back to device coords (y-down)
                        quads.push({
                            origin: { x: minX, y: pH - maxY },
                            size: { width: maxX - minX, height: maxY - minY }
                        });
                    } else {
                        quads.push({
                            origin: { x: minX, y: minY },
                            size: { width: maxX - minX, height: maxY - minY }
                        });
                    }
                }
                if (quads.length > 0) {
                    annotation.segmentRects = quads;
                }
            }
            if (!annotation.segmentRects) {
                const segmentRectsEl = child.querySelector("segment-rects");
                if (segmentRectsEl && segmentRectsEl.textContent) {
                    const rectStrings = segmentRectsEl.textContent.split(";").filter(s => s.trim());
                    annotation.segmentRects = rectStrings.map(rectStr => parseRect(rectStr));
                } else {
                    // Fall back to using the rect as a single segment
                    annotation.segmentRects = [annotation.rect];
                }
            }

            // Read strokeColor from stroke-color attribute or fall back to color
            const strokeColorAttr = child.getAttribute("stroke-color");
            if (strokeColorAttr) {
                annotation.strokeColor = unescapeXml(strokeColorAttr);
            } else {
                const colorVal = child.getAttribute("color");
                if (colorVal) {
                    annotation.strokeColor = unescapeXml(colorVal);
                }
            }
        }

        const color = child.getAttribute("color");
        if (color) {
            annotation.color = unescapeXml(color);
        }

        const title = child.getAttribute("title");
        if (title) {
            annotation.author = unescapeXml(title);
        }

        const creationDate = child.getAttribute("creationdate");
        if (creationDate) {
            annotation.created = parseDate(creationDate);
        }

        const modDate = child.getAttribute("date");
        if (modDate) {
            annotation.modified = parseDate(modDate);
        }

        const opacity = child.getAttribute("opacity");
        if (opacity) {
            annotation.opacity = parseFloat(opacity);
        }

        const contentsEl = child.querySelector("contents");
        if (contentsEl && contentsEl.textContent) {
            annotation.contents = unescapeXml(contentsEl.textContent);
        }

        const inReplyTo = child.getAttribute("inreplyto");
        if (inReplyTo) {
            annotation.inReplyToId = unescapeXml(inReplyTo);
        }

        const icon = child.getAttribute("icon");
        if (icon) {
            annotation.icon = unescapeXml(icon);
        }

        const flags = child.getAttribute("flags");
        if (flags) {
            annotation.flags = flags.split(",").map(f => f.trim());
        }

        // FreeText-specific import
        if (typeCode === 3) {
            // In XFDF, color = border for freetext; fix the generic mapping
            if (annotation.color) {
                annotation.strokeColor = annotation.color;
            }
            // interior-color = background/fill
            const interiorColor = child.getAttribute("interior-color");
            if (interiorColor) {
                annotation.color = unescapeXml(interiorColor);
                annotation.backgroundColor = unescapeXml(interiorColor);
            } else {
                annotation.color = "transparent";
                annotation.backgroundColor = "transparent";
            }

            // rotation
            const rotation = child.getAttribute("rotation");
            if (rotation) {
                annotation.rotation = parseFloat(rotation);
            }

            // justification → textAlign
            const justification = child.getAttribute("justification");
            if (justification) {
                annotation.textAlign = parseInt(justification, 10);
            }

            // intent
            const intent = child.getAttribute("intent");
            if (intent) {
                annotation.intent = unescapeXml(intent);
            }

            // callout line points
            const callout = child.getAttribute("callout");
            if (callout) {
                const vals = callout.split(",").map(Number);
                const points: Array<{ x: number; y: number }> = [];
                for (let i = 0; i + 1 < vals.length; i += 2) {
                    points.push({ x: vals[i], y: vals[i + 1] });
                }
                if (points.length > 0) {
                    annotation.calloutLine = points;
                }
            }

            // line ending
            const head = child.getAttribute("head");
            if (head) {
                annotation.lineEnding = unescapeXml(head);
            }

            // stroke width
            const width = child.getAttribute("width");
            if (width) {
                annotation.strokeWidth = parseFloat(width);
            }

            // Parse <defaultappearance> → fontFamily, fontSize, fontColor
            const daEl = child.querySelector("defaultappearance");
            if (daEl && daEl.textContent) {
                const da = daEl.textContent;
                const fontMatch = da.match(/\/(\S+)\s+([\d.]+)\s+Tf/);
                if (fontMatch) {
                    const fontCode = pdfFontNameToCode[fontMatch[1].toLowerCase()];
                    annotation.fontFamily = fontCode !== undefined ? fontCode : 4;
                    annotation.fontSize = parseFloat(fontMatch[2]);
                }
                const colorMatch = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
                if (colorMatch) {
                    annotation.fontColor = rgbFloatsToHex(
                        parseFloat(colorMatch[1]),
                        parseFloat(colorMatch[2]),
                        parseFloat(colorMatch[3])
                    );
                }
            }

            // Parse <defaultstyle> for verticalAlign
            const dsEl = child.querySelector("defaultstyle");
            if (dsEl && dsEl.textContent) {
                const vaMatch = dsEl.textContent.match(/vertical-align:\s*(\d+)/);
                if (vaMatch) {
                    annotation.verticalAlign = parseInt(vaMatch[1], 10);
                }
            }

            // Ensure required FreeText fields have defaults
            if (annotation.fontFamily === undefined) {
                annotation.fontFamily = 4;
            } // Helvetica
            if (annotation.fontSize === undefined) {
                annotation.fontSize = 12;
            }
            if (!annotation.fontColor) {
                annotation.fontColor = "#000000";
            }
            if (annotation.textAlign === undefined) {
                annotation.textAlign = 0;
            } // Left
            if (annotation.verticalAlign === undefined) {
                annotation.verticalAlign = 0;
            } // Top
            if (annotation.opacity === undefined) {
                annotation.opacity = 1;
            }
            if (annotation.contents === undefined) {
                annotation.contents = "";
            }
        }

        annotations.push(annotation);
    }

    return annotations;
}
