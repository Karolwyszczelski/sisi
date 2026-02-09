"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Sprawdź zapisany motyw w localStorage
    const savedTheme = localStorage.getItem("admin-theme") as Theme | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Zapisz motyw w localStorage
    localStorage.setItem("admin-theme", theme);
    
    // Dodaj/usuń klasę do body
    if (theme === "dark") {
      document.documentElement.classList.add("admin-dark");
      document.documentElement.classList.remove("admin-light");
    } else {
      document.documentElement.classList.add("admin-light");
      document.documentElement.classList.remove("admin-dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Helper do generowania klas w zależności od motywu
export function useThemeClasses() {
  const { isDark } = useTheme();
  
  return {
    // Tła
    bg: isDark ? "bg-slate-900" : "bg-gray-50",
    bgCard: isDark ? "bg-slate-800/60" : "bg-white",
    bgCardHover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-50",
    bgInput: isDark ? "bg-slate-900" : "bg-white",
    bgSection: isDark ? "bg-slate-900/50" : "bg-gray-100",
    
    // Obramowania
    border: isDark ? "border-slate-700/50" : "border-gray-200",
    borderHover: isDark ? "hover:border-slate-600" : "hover:border-gray-300",
    
    // Teksty
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-slate-400" : "text-gray-600",
    textSubtle: isDark ? "text-slate-500" : "text-gray-500",
    
    // Przyciski
    btnPrimary: isDark 
      ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
      : "bg-emerald-600 hover:bg-emerald-500 text-white",
    btnSecondary: isDark 
      ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
      : "bg-gray-200 hover:bg-gray-300 text-gray-700",
    
    // Status
    statusNew: isDark ? "border-amber-500/30 bg-slate-800/80" : "border-amber-400 bg-amber-50",
    statusAccepted: isDark ? "border-blue-500/30 bg-slate-800/80" : "border-blue-400 bg-blue-50",
    statusCancelled: isDark ? "border-rose-500/30 bg-slate-800/80" : "border-rose-400 bg-rose-50",
    statusCompleted: isDark ? "border-slate-600/30 bg-slate-800/60" : "border-gray-300 bg-gray-50",
  };
}
