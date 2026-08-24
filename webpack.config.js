const path = require('path');

class FinalNewlinePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('FinalNewlinePlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'FinalNewlinePlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      }, () => {
        for (const asset of compilation.getAssets()) {
          const content = asset.source.source().toString();
          if (!content.endsWith('\n')) {
            compilation.updateAsset(
                asset.name,
                new compiler.webpack.sources.RawSource(`${content}\n`),
            );
          }
        }
      });
    });
  }
}

const moduleVal = {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    },
  ],
};

const codeMirrorPackages = [
  '@codemirror/state',
  '@codemirror/view',
];

const umdExternals = {
  '@codemirror/state': {
    commonjs: '@codemirror/state',
    commonjs2: '@codemirror/state',
    amd: '@codemirror/state',
    root: 'CodeMirrorState',
  },
  '@codemirror/view': {
    commonjs: '@codemirror/view',
    commonjs2: '@codemirror/view',
    amd: '@codemirror/view',
    root: 'CodeMirrorView',
  },
};

function libraryConfig(filename, library, extra = {}) {
  return {
    entry: './src/index.js',
    output: {
      filename,
      library,
      path: path.resolve(__dirname, 'dist'),
      globalObject: 'globalThis',
    },
    module: moduleVal,
    plugins: [new FinalNewlinePlugin()],
    ...extra,
  };
}

const config = [
  libraryConfig('main.js', {type: 'umd'}, {externals: umdExternals}),
  libraryConfig('index.mjs', {type: 'module'}, {
    experiments: {outputModule: true},
    externals: codeMirrorPackages,
    externalsType: 'module',
  }),
  libraryConfig('index.cjs', {type: 'commonjs2'}, {
    externals: codeMirrorPackages,
    externalsType: 'commonjs',
  }),
  {
    entry: './demo/index.js',
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'demo'),
    },
    module: moduleVal,
    plugins: [new FinalNewlinePlugin()],
  },
];

const browserFixtureConfig = {
  entry: './test/browser/fixture.js',
  output: {
    filename: 'fixture.bundle.js',
    path: path.resolve(__dirname, 'test/browser'),
  },
  module: moduleVal,
  plugins: [new FinalNewlinePlugin()],
};

module.exports = (environment = {}) => environment.browserFixture ?
  [browserFixtureConfig] : config;
