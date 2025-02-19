const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = (env) => {
  const isTizenBuild = env.platform === 'tizen';
  
  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.[contenthash].js',
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@components': path.resolve(__dirname, 'src/components/'),
        '@services': path.resolve(__dirname, 'src/services/'),
        '@utils': path.resolve(__dirname, 'src/utils/')
      }
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react',
                '@babel/preset-typescript'
              ],
              plugins: [
                '@babel/plugin-transform-runtime'
              ]
            }
          }
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader']
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[hash][ext][query]'
          }
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[hash][ext][query]'
          }
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        inject: true,
        minify: {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'public/config.xml',
            transform(content) {
              const packageJson = require('./package.json');
              return content.toString().replace(
                /<tizen:application (.+?) version="[^"]+"/g,
                `<tizen:application $1 version="${packageJson.version}"`
              );
            }
          },
          { from: 'public/assets', to: 'assets' }
        ]
      }),
      ...(isTizenBuild ? [
        new ZipPlugin({
          path: '../',
          filename: 'TabarekIPTV.wgt',
          extension: 'wgt',
          include: [/\.js$/, /\.html$/, /\.xml$/, /assets\/.*/, /fonts\/.*/]
        })
      ] : [])
    ],
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 5,
            compress: {
              drop_console: isTizenBuild,
              drop_debugger: isTizenBuild,
              pure_funcs: isTizenBuild ? ['console.log', 'console.info'] : []
            },
            safari10: true
          }
        })
      ],
      splitChunks: {
        chunks: 'all',
        name: false,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      compress: true,
      port: 3000,
      hot: true,
      historyApiFallback: true
    },
    performance: {
      hints: false
    },
    target: ['web', 'es5'],
    cache: false,
    stats: {
      errorDetails: true,
      warnings: false
    },
    devtool: false,
    ignoreWarnings: [/Failed to parse source map/],
    bail: false
  };
};