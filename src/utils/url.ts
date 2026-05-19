export const resolveUri = async (uri: unknown): Promise<string | null> => {
    if (!uri) {
        return null;
    }

    if (typeof uri === "string") {
        return uri;
    }

    if (typeof (uri as PromiseLike<string>).then === "function") {
        try {
            return await (uri as Promise<string>);
        } catch (error) {
            console.error("Error resolving file URI promise:", error);
            return null;
        }
    }

    return null;
};

/**
 * Extract GUID from file URL
 */
export const getGuidFromUrl = (url: string): string | null => {
    if (!url) {
        return null;
    }

    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

    try {
        const parsed = new URL(url);
        const guidParam = parsed.searchParams.get("guid");
        if (guidParam) {
            return guidParam;
        }

        // Offline URLs can be blob:http://host/<uuid>
        const pathMatch = parsed.pathname.match(uuidPattern);
        if (pathMatch) {
            return pathMatch[0];
        }
    } catch {
        // Ignore URL parsing errors and fall back to regex extraction.
    }

    const uuidMatch = url.match(uuidPattern);
    return uuidMatch ? uuidMatch[0] : null;
};
