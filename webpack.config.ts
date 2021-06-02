import { default as nodeConfig } from 'config';
import { resolve } from 'path';
import { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';
import { DefinePlugin, EnvironmentPlugin, ProvidePlugin } from 'webpack';

const { NODE_ENV: mode = 'development' } = process.env;

const config: Configuration = {
  externalsPresets: { node: true },
  externals: [nodeExternals()],
  //externals: [nodeExternals({
  //  allowlist: ['https'],
  //})],
  mode: mode as Configuration['mode'],
  devtool: 'source-map',
  entry: './src/index.ts',
  output: {
    filename: 'libsignal-service.js',
    globalObject: 'this',
    library: {
      name: 'libsignal-service',
      type: 'umd',
    },
  },
  plugins: [
   new EnvironmentPlugin(['npm_package_version']),
   new ProvidePlugin({
    window: 'global/window',
    btoa: 'btoa',
    Event: [resolve(__dirname, 'src/shims/Event'), 'EventShim'],
   }),
   new DefinePlugin({
     CONFIG: JSON.stringify(nodeConfig),
   }),
  ],
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.proto'],
    alias: {
      '../libsignal.d': resolve(__dirname, 'src/types/libsignal'),
      '../textsecure.d': resolve(__dirname, 'src/types/textsecure'),
      '../window.d': resolve(__dirname, 'src/types/window'),
      './window.d': resolve(__dirname, 'src/types/window'),
      '../types/Util': resolve(__dirname, 'src/types/Util'),
      './Util': resolve(__dirname, 'src/types/Util'),
      '../protobuf': resolve(__dirname, 'src/shims'),
      '../RemoteConfig': resolve(__dirname, 'src/shims'),
      '../../js/modules/stickers': resolve(__dirname, 'src/shims'),
      '../groups': resolve(__dirname, 'src/shims/groups'),
      '../logging/log': resolve(__dirname, 'src/shims'),
      //'https': resolve(__dirname, 'src/shims/https'),
      'proxy-agent': resolve(__dirname, 'src/shims/proxy-agent'),
    },
    fallback: {
      'assert': require.resolve('assert'),
      'buffer': require.resolve('buffer'),
      'crypto': require.resolve('crypto-browserify'),
      'http': require.resolve('stream-http'),
      'https': require.resolve('https-browserify'),
      'os': require.resolve('os-browserify/browser'),
      'path': require.resolve('path-browserify'),
      'stream': require.resolve('stream-browserify'),
      'url': require.resolve('url'),
      'util': require.resolve('util'),
      'vm': require.resolve('vm-browserify'),
      'zlib': require.resolve('browserify-zlib'),
    },
    modules: [resolve(__dirname, 'src/js'), 'node_modules'],
  },
};

export default config;
