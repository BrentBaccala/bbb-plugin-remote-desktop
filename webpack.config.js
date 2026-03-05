const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const fs = require('fs');

module.exports = {
  entry: './src/index.tsx',
  output: {
    filename: 'RemoteDesktop.[contenthash:8].js',
    clean: true,
    library: 'RemoteDesktop',
    libraryTarget: 'umd',
    publicPath: '/',
    globalObject: 'this',
  },
  experiments: {
    topLevelAwait: true,
  },
  devServer: {
    allowedHosts: 'all',
    port: 4701,
    host: '0.0.0.0',
    hot: false,
    liveReload: false,
    client: {
      overlay: false,
    },
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }
      devServer.app.get('/manifest.json', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'manifest.json'));
      });
      return middlewares;
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.tsx', '.ts'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: './' },
        { from: 'locales', to: './locales' },
      ],
    }),
    {
      apply(compiler) {
        compiler.hooks.afterEmit.tap('UpdateManifest', (compilation) => {
          const jsFile = [...compilation.entrypoints.get('main').getFiles()].find(f => f.endsWith('.js'));
          if (jsFile) {
            const manifestPath = path.join(compilation.outputOptions.path, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.javascriptEntrypointUrl = jsFile;
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
          }
        });
      },
    },
  ],
};
