import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'

const OPENCLAW_CONFIG_DIR = path.join(os.homedir(), '.openclaw')
const OPENCLAW_CONFIG_FILE = path.join(OPENCLAW_CONFIG_DIR, 'config.json')
const DEFAULT_PORT = 3100

interface OpenClawConfig {
  channels?: Record<string, unknown>
  claveChannelPort?: number
  claveChannelApiKey?: string
  [key: string]: unknown
}

function loadConfig(): OpenClawConfig {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as OpenClawConfig
  } catch {
    return {}
  }
}

function saveConfig(config: OpenClawConfig): void {
  fs.mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true })
  fs.writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export function install(port = DEFAULT_PORT): { apiKey: string; port: number } {
  const config = loadConfig()

  const apiKey = randomUUID()
  config.channels = config.channels || {}
  config.channels['clave'] = {
    enabled: true,
    port,
    apiKey
  }
  config.claveChannelPort = port
  config.claveChannelApiKey = apiKey

  saveConfig(config)

  console.log(`Clave channel plugin installed:`)
  console.log(`  Port: ${port}`)
  console.log(`  API Key: ${apiKey}`)
  console.log(`  Config: ${OPENCLAW_CONFIG_FILE}`)

  return { apiKey, port }
}

export function uninstall(): void {
  const config = loadConfig()

  if (config.channels) {
    delete config.channels['clave']
  }
  delete config.claveChannelPort
  delete config.claveChannelApiKey

  saveConfig(config)

  console.log('Clave channel plugin uninstalled.')
}
