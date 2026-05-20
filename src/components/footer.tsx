import { Brain } from 'lucide-react'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-gray-500 tracking-wide">
              Neurorad Call Autopilot
            </span>
          </div>
          <span className="text-xs text-gray-400">
            &copy; {year} BudSoft Inc. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}
