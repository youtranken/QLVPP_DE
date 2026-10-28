import { createContext, useContext } from 'react';

// Popover mở trong dialog phải portal vào trong Content, nếu không Radix chặn click lẫn cuộn
export const DialogPortalContext = createContext<HTMLElement | null>(null);
export const useDialogPortal = () => useContext(DialogPortalContext);
