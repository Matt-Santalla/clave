import { useState, useCallback, useMemo } from 'react'

export interface RemoteTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: RemoteTreeNode[]
  expanded: boolean
  loading: boolean
  depth: number
}

export interface FlatRemoteTreeNode extends RemoteTreeNode {
  depth: number
}

function flattenTree(nodes: RemoteTreeNode[], depth = 0): FlatRemoteTreeNode[] {
  const result: FlatRemoteTreeNode[] = []
  for (const node of nodes) {
    result.push({ ...node, depth })
    if (node.type === 'directory' && node.expanded && node.children) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

export function useRemoteFileTree(locationId: string | undefined, cwd: string | null) {
  const [rootNodes, setRootNodes] = useState<RemoteTreeNode[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDir = useCallback(
    async (dirPath: string): Promise<RemoteTreeNode[]> => {
      if (!locationId || !window.electronAPI?.sftpReadDir) return []
      try {
        const entries = await window.electronAPI.sftpReadDir(locationId, dirPath)
        return (entries as Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>)
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          .map((entry) => ({
            name: entry.name,
            path: entry.path,
            type: entry.type,
            size: entry.size,
            expanded: false,
            loading: false,
            depth: 0
          }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read directory')
        return []
      }
    },
    [locationId]
  )

  const loadRoot = useCallback(async () => {
    if (!cwd || !locationId) return
    setError(null)
    const nodes = await loadDir(cwd)
    setRootNodes(nodes)
    setLoaded(true)
  }, [cwd, locationId, loadDir])

  const refresh = useCallback(() => {
    setLoaded(false)
    loadRoot()
  }, [loadRoot])

  const toggleExpand = useCallback(
    async (nodePath: string) => {
      const updateNodes = (nodes: RemoteTreeNode[]): RemoteTreeNode[] =>
        nodes.map((node) => {
          if (node.path === nodePath) {
            if (node.expanded) {
              return { ...node, expanded: false }
            }
            if (node.children) {
              return { ...node, expanded: true }
            }
            return { ...node, loading: true }
          }
          if (node.children) {
            return { ...node, children: updateNodes(node.children) }
          }
          return node
        })

      setRootNodes((prev) => updateNodes(prev))

      // Load children if needed
      const findNode = (nodes: RemoteTreeNode[]): RemoteTreeNode | null => {
        for (const node of nodes) {
          if (node.path === nodePath) return node
          if (node.children) {
            const found = findNode(node.children)
            if (found) return found
          }
        }
        return null
      }

      const node = findNode(rootNodes)
      if (node && !node.children && node.type === 'directory') {
        const children = await loadDir(nodePath)
        setRootNodes((prev) => {
          const update = (nodes: RemoteTreeNode[]): RemoteTreeNode[] =>
            nodes.map((n) => {
              if (n.path === nodePath) {
                return { ...n, children, expanded: true, loading: false }
              }
              if (n.children) {
                return { ...n, children: update(n.children) }
              }
              return n
            })
          return update(prev)
        })
      }
    },
    [rootNodes, loadDir]
  )

  const flatNodes = useMemo(() => flattenTree(rootNodes), [rootNodes])

  return {
    rootNodes,
    flatNodes,
    loaded,
    error,
    loadRoot,
    refresh,
    toggleExpand
  }
}
