import React, { createContext, useContext, useState } from 'react';
import { lightColors, darkColors, getTypography, spacing, radius } from './index';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => setIsDark(prev => !prev);

  const colors = isDark ? darkColors : lightColors;
  const typography = getTypography(colors);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, typography, spacing, radius }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
