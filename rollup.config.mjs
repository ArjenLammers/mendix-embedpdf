import { readFileSync } from 'fs';

export default args => {
    const result = args.configDefaultConfig;
    const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
    const buildId = `${pkg.version}+${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
    console.warn(`\n  EmbedPDF build: ${buildId}\n`);
    return result.map((config) => {
                config.output.inlineDynamicImports = true;
                config.output.banner = `globalThis.__EMBEDPDF_BUILD__ = ${JSON.stringify(buildId)};`;
                return config;
    });
};
