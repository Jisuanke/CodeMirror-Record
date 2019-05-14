const path = require('path');

const moduleVal = {
  rules: [
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
