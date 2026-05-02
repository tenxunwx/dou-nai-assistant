const app = require('./app')
const { port, nodeEnv } = require('./config/env')
const { initDatabase } = require('./config/db')

const bootstrap = async () => {
  await initDatabase()
  app.listen(port, () => {
    console.log(`[${nodeEnv}] Backend running at http://localhost:${port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start backend:', error.message)
  process.exit(1)
})
