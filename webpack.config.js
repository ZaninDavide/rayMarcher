var path = require("path")
const HtmlWebPackPlugin = require("html-webpack-plugin")

// webpack.config.js
module.exports = {
    entry: "./src/sketch.js",
    output: {
        path: path.resolve(__dirname, "build"),
        filename: "sketch.js",
    },
    module: {
        noParse: /./,
        rules: [
            {
                test: /\.js$/,
                loader: "babel-loader",
                query: {
                    presets: ["@babel/preset-env"],
                },
            },
            {
                test: /\.vert$/i,
                use: "raw-loader",
            },
            {
                test: /\.frag$/i,
                use: "raw-loader",
            },
        ],
    },
    devServer: {
        contentBase: "build",
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: "./src/index.html",
            filename: "./index.html",
        }),
    ],
}
