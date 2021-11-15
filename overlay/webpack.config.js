const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const WebpackAssetsManifest = require('webpack-assets-manifest');

module.exports = {
    mode: 'development',
    devtool: false,
    output: {
        path: path.resolve(__dirname, 'build'),
        clean: true
    },
    entry: "./src/index.tsx",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                        },
                    },
                ],
                include: path.resolve(__dirname, 'src')
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: [/\.eot$/, /\.ttf$/, /\.woff$/, /\.woff2$/, /\.svg$/, /\.png$/],
                use: 'file-loader'
            }
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    plugins: [
        new HtmlWebpackPlugin({ template: "public/index.html" }),
        new ForkTsCheckerWebpackPlugin(),
        new WebpackAssetsManifest(),
    ],
    devServer: {
        contentBase: path.join(__dirname, "build"),
        port: 3000,
        https: true,
        hot: false,
        inline: false,
        liveReload: false,
        open: false
    }
};