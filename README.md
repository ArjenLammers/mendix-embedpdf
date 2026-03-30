# EmbedPDF

A Mendix Pluggable Widget that embeds the [EmbedPDF](https://www.embedpdf.com/) viewer into your Mendix application, providing a PDF viewing and annotation experience powered by a WebAssembly-based PDF engine (pdfium).

## Features

- **PDF Viewing** — Render PDF documents from Mendix `FileDocument` entities directly in the browser.
- **Annotations** — Create, edit, and delete annotations (highlights, underlines, strikeouts, sticky notes, ink, stamps, shapes, freetext, and more). Annotation state is persisted as XFDF.
- **Redaction** — Mark areas or text for redaction and apply redactions (optionally disabled).
- **Zoom Controls** — Zoom in/out, fit-to-page, fit-to-width, marquee zoom, and zoom level display.
- **Page Navigation** — Scroll, spread, rotate, and navigate pages. Active page number is exposed as an attribute.
- **Document Operations** — Open, close, print, capture, export, fullscreen, and password-protect documents.
- **Panels** — Sidebar, search, and comment panels.
- **Tools** — Pan, pointer, capture, and text selection with copy support.
- **History** — Undo / redo support for annotation changes.
- **Theming** — Light, dark, and system theme preferences.
- **Read-Only Mode** — Disable all modification capabilities with a single toggle.
- **Feature Toggles** — Every toolbar category and individual control can be shown or hidden via widget properties in Mendix Studio Pro.
- **XFDF Sync** — Annotation changes are serialized to XFDF and written to a Mendix attribute. An `OnXfdfChange` action can trigger a microflow to persist changes.

## Usage

1. Build the widget (see [Development](#development-and-contribution)).
2. Copy the resulting `.mpk` file from `dist/` into your Mendix project's `widgets/` folder.
3. Copy the `pdfium.wasm` file into your Mendix theme folder (see [WASM Setup](#copying-the-wasm-file-into-the-mendix-theme-folder)).
4. In Studio Pro, add the **Embed PDF** widget to a page inside a data view that provides a `FileDocument` (or specialization).
5. Configure the widget properties:
   - **File** — the `FileDocument` attribute to display.
   - **Active page** — (optional) an `Integer` attribute to track the current page.
   - **Theme** — light / dark / system.
   - **Features** — toggle individual toolbar categories on or off.
   - **Annotations** — enable annotations, set the author attribute, bind an XFDF string attribute, and configure the `OnXfdfChange` action.

## Updating the `@embedpdf/react-pdf-viewer` Dependency

When a new version of the EmbedPDF viewer is released, follow these steps to update:

1. **Check the current version**

   ```bash
   npm ls @embedpdf/react-pdf-viewer
   ```

2. **Update to the latest version**

   ```bash
   npm install @embedpdf/react-pdf-viewer@latest
   ```

   Or pin a specific version:

   ```bash
   npm install @embedpdf/react-pdf-viewer@2.10.1
   ```

3. **Verify the update**

   ```bash
   npm ls @embedpdf/react-pdf-viewer
   ```

4. **Rebuild the widget**

   ```bash
   npm run build
   ```

5. **Copy the new WASM file** into your Mendix theme folder (see next section).

6. **Test** the widget in your Mendix application to confirm everything works correctly.

> **Note:** After updating the npm package, always copy the updated `pdfium.wasm` file to the Mendix theme folder as well — the viewer and WASM engine must stay in sync.

## Copying the WASM File into the Mendix Theme Folder

The EmbedPDF viewer uses a WebAssembly build of the pdfium engine. The widget expects `pdfium.wasm` to be available at the **web root** of the Mendix application (i.e. `https://<host>/pdfium.wasm`). In Mendix, files placed in the `theme/web/` folder are served at the root.

### Steps

1. **Locate the WASM file** inside `node_modules`:

   ```
   node_modules/@embedpdf/pdfium/dist/pdfium.wasm
   ```

2. **Copy it to the Mendix theme folder** of your Mendix project:

   ```bash
   # From the widget project root — adjust the Mendix project path as needed
   cp node_modules/@embedpdf/pdfium/dist/pdfium.wasm  <mendix-project>/theme/web/pdfium.wasm
   ```

   On Windows (PowerShell):

   ```powershell
   Copy-Item node_modules\@embedpdf\pdfium\dist\pdfium.wasm  <mendix-project>\theme\web\pdfium.wasm
   ```

   Replace `<mendix-project>` with the path to your Mendix project (e.g. `D:\projects\EmbedPDF-main`).

3. **Verify** by starting/redeploying the Mendix app and navigating to `http://localhost:8080/pdfium.wasm` — you should get a binary download (not a 404).

> **Important:** Repeat this step every time you update the `@embedpdf/react-pdf-viewer` dependency to ensure the WASM file matches the viewer version.

## Development and Contribution

1. Install dependencies:

   ```bash
   npm install
   ```

   If you use NPM v7+ and encounter peer-dependency conflicts:

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure the Mendix project path** in `package.json` → `config.projectPath` so the dev server can deploy the widget automatically.

3. Start the development server (watches for changes and hot-reloads):

   ```bash
   npm start
   ```

   On every change:
   - The widget is bundled.
   - The bundle is placed in `dist/`.
   - The bundle is deployed to the `deployment` and `widgets` folders of the configured Mendix test project.

4. **Build for production:**

   ```bash
   npm run build
   ```

5. **Create a release `.mpk`:**

   ```bash
   npm run release
   ```

6. **Lint:**

   ```bash
   npm run lint
   npm run lint:fix
   ```

## License

MIT — see [LICENSE](LICENSE) for details.
