const command = process.argv[2]

async function main() {
  switch (command) {
    case 'dev': {
      const { runDev } = await import('./dev.js')
      await runDev()
      break
    }
    case 'build': {
      const { runBuild } = await import('./build.js')
      await runBuild()
      break
    }
    case 'serve': {
      const { runServe } = await import('./serve.js')
      await runServe()
      break
    }
    default:
      console.error(`Unknown command: ${command ?? '(none)'}`)
      console.error('Usage: vorzelajs <dev|build|serve>')
      process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
