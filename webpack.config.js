'use strict';

const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = [{
  context: __dirname + '/src',
  entry: {
    index: "./index.js"
  },
  output: {
    path: __dirname + '/dst',
    filename: './[name].js'
  },
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, use: { loader: 'babel-loader' } },
      { test: /\.s?css$/, use: ExtractTextPlugin.extract({ use: [
        { loader: 'css-loader', options: { importLoaders: 1 } },
        { loader: 'postcss-loader', options: {
          plugins: [
            require('postcss-import')({ addDependencyTo: 'webpack' }),
            require('postcss-nesting')(),
            require('postcss-cssnext')({ browsers: ['last 2 versions'] }),
            require('perfectionist')({ indentSize: 2 })
          ],
          publicPath: '../'
        } }] }) },
      { test: /\.(?:woff2)$/, use: { loader: 'file-loader', options: { name: '[path][name].[ext]' } } },
      { test: /\.htaccess$/, use: { loader: 'file-loader', options: { name: '[path][name]' } } },
      { test: /\.html$/, use: [
        { loader: 'file-loader', options: { name: '[path][name].[ext]' } },
        'extract-loader',
        { loader: 'html-loader', options: { conservativeCollapse: false } }
        ] }
    ]
  },
  plugins: [
    new ExtractTextPlugin('[name].css')
  ]
}];
