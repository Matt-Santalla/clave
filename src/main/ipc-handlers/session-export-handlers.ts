import { ipcMain, dialog, BrowserWindow } from 'electron'
import { existsSync, readFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

function getJsonlPath(cwd: string, claudeSessionId: string): string {
  const projectDir = cwd.replace(/[/.]/g, '-')
  return join(homedir(), '.claude', 'projects', projectDir, `${claudeSessionId}.jsonl`)
}

function findPlanFilePath(jsonlPath: string): string | null {
  try {
    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (!line) continue
      if (!line.includes('planFilePath')) continue
      try {
        const entry = JSON.parse(line)
        const planPath =
          entry.planFilePath ||
          entry.message?.content?.find?.(
            (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'ExitPlanMode'
          )?.input?.planFilePath
        if (planPath && existsSync(planPath)) return planPath
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file doesn't exist
  }
  return null
}

export function registerSessionExportHandlers(): void {
  ipcMain.handle(
    'session:save-discussion',
    async (_event, cwd: string, claudeSessionId: string, sessionName: string) => {
      const win = BrowserWindow.fromWebContents(_event.sender)
      const jsonlPath = getJsonlPath(cwd, claudeSessionId)

      if (!existsSync(jsonlPath)) return { success: false, error: 'Discussion file not found' }

      const result = await dialog.showSaveDialog(win!, {
        defaultPath: `${sessionName}.jsonl`,
        filters: [
          { name: 'JSONL', extensions: ['jsonl'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' }

      try {
        copyFileSync(jsonlPath, result.filePath)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    'session:save-plan',
    async (_event, cwd: string, claudeSessionId: string, sessionName: string) => {
      const win = BrowserWindow.fromWebContents(_event.sender)
      const jsonlPath = getJsonlPath(cwd, claudeSessionId)
      const planPath = findPlanFilePath(jsonlPath)

      if (!planPath) return { success: false, error: 'No plan found in this session' }

      const result = await dialog.showSaveDialog(win!, {
        defaultPath: `${sessionName}-plan.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'cancelled' }

      try {
        copyFileSync(planPath, result.filePath)
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
