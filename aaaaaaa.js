export default function (webpackConfig, env) {
  webpackConfig.module.rules.push({
    test: /\.worker\.js$/,
    use: { loader: 'worker-loader' }
  })
  return webpackConfig
}