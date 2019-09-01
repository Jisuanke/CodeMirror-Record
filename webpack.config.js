const path = require('path');

const moduleVal = {
  rules: [
    {
      enforce: 'pre',
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'eslint-loader'
    },
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env']
        }
      }
    }
  ]
}

const config = [
  {
    entry: './src/index.js',
    output: {
      libraryTarget: 'umd',
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist')
    },
    module: moduleVal
  },
  {
    entry: './demo/index.js',
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'demo')
    },
    module: moduleVal
  },
];

module.exports = config;
