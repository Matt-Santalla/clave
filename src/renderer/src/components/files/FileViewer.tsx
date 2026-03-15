import { useCallback } from 'react'
import { useSessionStore, type FileTab } from '../../store/session-store'
import { FileContentRenderer } from './FileContentRenderer'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { CopyIcon, FolderIcon, ExternalLinkIcon, CloseIcon, fileActionButtonClass } from './FileActionIcons'

const EXTERNAL_EXTS = new Set(['html', 'htm', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'])

interface FileViewerProps {
  fileTab: FileTab
}

export function FileViewer({ fileTab }: FileViewerProps) {
  const removeFileTab = useSessionStore((s) => s.removeFileTab)

  const filename = fileTab.filePath.split('/').pop() ?? ''
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const canOpenExternally = EXTERNAL_EXTS.has(ext)
  // Extract cwd: everything up to the last path component
  const cwd = fileTab.filePath.substring(0, fileTab.filePath.lastIndexOf('/')) || '/'
  // Relative path for readFile: just the filename
  const relativePath = filename

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(fileTab.filePath)
  }, [fileTab.filePath])

  const handleRevealInFinder = useCallback(() => {
    window.electronAPI?.showItemInFolder(fileTab.filePath)
  }, [fileTab.filePath])

  const handleOpenExternally = useCallback(() => {
    window.electronAPI?.openPath(fileTab.filePath)
  }, [fileTab.filePath])

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <DocumentTextIcon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">{fileTab.name}</span>
          {fileTab.name !== filename && (
            <span className="text-xs text-text-tertiary truncate hidden sm:inline">{filename}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {canOpenExternally && (
            <button onClick={handleOpenExternally} className={fileActionButtonClass} title="Open externally">
              <ExternalLinkIcon />
            </button>
          )}
          <button onClick={handleCopyPath} className={fileActionButtonClass} title="Copy path">
            <CopyIcon />
          </button>
          <button onClick={handleRevealInFinder} className={fileActionButtonClass} title="Reveal in Finder">
            <FolderIcon />
          </button>
          <button onClick={() => removeFileTab(fileTab.id)} className={fileActionButtonClass} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Full path breadcrumb */}
      <div className="px-4 py-1 border-b border-border-subtle flex-shrink-0">
        <span className="text-[10px] text-text-tertiary truncate block">
          {fileTab.filePath.replace(/^\/Users\/[^/]+/, '~')}
        </span>
      </div>

      {/* File content */}
      <FileContentRenderer
        filePath={relativePath}
        cwd={cwd}
        className="flex-1"
      />
    </div>
  )
}
