import { AppShell } from './components/layout/AppShell'
import { TooltipProvider } from './components/ui/tooltip'

function App(): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={700} skipDelayDuration={300}>
      <AppShell />
    </TooltipProvider>
  )
}

export default App
