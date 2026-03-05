import { createContext, useContext } from 'react';

export const GlobalWidgetContext = createContext(null);

export const useGlobalWidgetContext = () => useContext(GlobalWidgetContext);
