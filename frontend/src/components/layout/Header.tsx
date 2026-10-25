import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "@/components/theme-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Menu01Icon,
  Sun01Icon,
  Moon01Icon,
} from "@hugeicons/core-free-icons"

interface HeaderProps {
  onOpenMobileNav: () => void
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Left side: Mobile menu toggle + Context indicator */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="md:hidden size-8 p-0"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
        >
          <HugeiconsIcon icon={Menu01Icon} className="size-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] h-5.5 font-mono text-muted-foreground border-border bg-background/50"
          >
            Project: Sentinel Core
          </Badge>
          <Badge
            variant="secondary"
            className="hidden sm:inline-flex text-[11px] h-5.5 font-normal text-muted-foreground"
          >
            Environment: Production
          </Badge>
        </div>
      </div>

      {/* Right side: Global actions + Theme Toggle */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground mr-2 font-mono">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Worker Engine Ready</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle visual theme"
          className="size-8 p-0"
        >
          {theme === "dark" ? (
            <HugeiconsIcon icon={Sun01Icon} className="size-3.5" />
          ) : (
            <HugeiconsIcon icon={Moon01Icon} className="size-3.5" />
          )}
        </Button>
      </div>
    </header>
  )
}
