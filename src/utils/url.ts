/**
 * Extract GUID from file URL
 */
export const getGuidFromUrl = (url: string): string | null => {
    const match = url.match(/[?&]guid=([^&]+)/);
    return match ? match[1] : null;
};
