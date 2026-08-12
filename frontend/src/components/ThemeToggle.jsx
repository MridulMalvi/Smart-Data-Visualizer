import { Sun, Moon } from 'lucide-react'
import useAppStore from '../store/useAppStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore()

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="btn btn-secondary"
      style={{ padding: '8px 12px', borderRadius: '12px' }}
    >
      {theme === 'light'
        ? <Moon size={18} strokeWidth={2} />
        : <Sun  size={18} strokeWidth={2} />}
    </button>
  )
}
