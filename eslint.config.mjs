import nextConfig from 'eslint-config-next'

const config = [
  {
    ignores: ['.next/**/*', 'node_modules/**/*', 'dist/**/*'],
  },
  ...nextConfig,
]

export default config
