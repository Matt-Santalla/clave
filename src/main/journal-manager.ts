// src/main/journal-manager.ts
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { JournalData } from '../shared/journal-types'

export type { JournalData, JournalEntry, JournalProject } from '../shared/journal-types'

class JournalManager {
  private filePath: string
  private archiveDir: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'assistant-journal.json')
    this.archiveDir = path.join(app.getPath('userData'), 'journal-archive')
  }

  async load(): Promise<JournalData> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as JournalData
    } catch {
      return { date: '', projects: [] }
    }
  }

  async save(data: JournalData): Promise<void> {
    const tmp = this.filePath + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
    await fs.rename(tmp, this.filePath)
  }

  async archive(data: JournalData): Promise<void> {
    if (!data.date || data.projects.length === 0) return
    await fs.mkdir(this.archiveDir, { recursive: true })
    const archivePath = path.join(this.archiveDir, `${data.date}.json`)
    await fs.writeFile(archivePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async listArchives(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.archiveDir)
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''))
        .sort()
        .reverse()
    } catch {
      return []
    }
  }

  async loadArchive(date: string): Promise<JournalData | null> {
    try {
      const archivePath = path.join(this.archiveDir, `${date}.json`)
      const raw = await fs.readFile(archivePath, 'utf-8')
      return JSON.parse(raw) as JournalData
    } catch {
      return null
    }
  }
}

export const journalManager = new JournalManager()
