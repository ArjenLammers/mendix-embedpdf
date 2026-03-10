export default args => {
    const result = args.configDefaultConfig;
    console.warn ('Custom roll up')
    return result.map((config) => {
                config.output.inlineDynamicImports = true
                console.warn ("Set dynamic imports")
                return config;
    });
};
