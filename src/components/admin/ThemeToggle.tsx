"use client";

import { useTheme } from "./ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200
        ${isDark 
          ? "bg-slate-700 hover:bg-slate-600 text-amber-400" 
          : "bg-gray-200 hover:bg-gray-300 text-gray-700"
        }
      `}
      title={isDark ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
