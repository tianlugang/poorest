export function sourceLoaders() {
    return [
        {
            // test: /\.(jpg|png|svg|gif)/,
            test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
            use: [
                // {
                //  webpack通过file-loader处理资源文件，它会将rules规则命中的资源文件按照配置的信息（路径，名称等）
                // 输出到指定目录，
                // 并返回其资源定位地址（输出路径，用于生产环境的publicPath路径），
                // 默认的输出名是以原文件内容计算的MD5 Hash命名的
                //     loader: "file-loader",
                //     options: {
                //         outputPath: "images/"
                //     }
                // },
                {
                    // 构建工具通过url-loader来优化项目中对于资源的引用路径，并设定大小限制，当资源的体积小于limit时将其直接进行Base64转换后嵌入引用文件，体积大于limit时可通过fallback参数指定的loader进行处理。
                    // 打包后可以看到小于8k的资源被直接内嵌进了CSS文件而没有生成独立的资源文件
                    loader: 'url-loader',
                    options: {
                        limit: 8129,//小于limit限制的图片将转为base64嵌入引用位置
                        fallback: 'file-loader',//大于limit限制的将转交给指定的loader处理，开启这里后就无需再单独配置file-loader
                        outputPath: 'images/'//options会直接传给fallback指定的loader
                    }
                }
            ]
        },
        {
            test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
            use: [
                {
                    loader: 'url-loader',
                    options: {
                        limit: 8129,
                        fallback: 'file-loader',
                        outputPath: 'fonts/'
                    }
                }
            ]
        }
    ]
}