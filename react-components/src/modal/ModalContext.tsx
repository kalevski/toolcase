import React, { createContext, useContext, ReactNode } from 'react'
import { ModalControl } from './ModalControl'

const modalControl = new ModalControl()

const ModalContextValue = createContext<ModalControl | null>(null)

export interface ModalContextProps {
	children: ReactNode
}

export function ModalContext({ children }: ModalContextProps) {
	return <ModalContextValue.Provider value={modalControl}>{children}</ModalContextValue.Provider>
}

export function useModalControl(): ModalControl {
	const context = useContext(ModalContextValue)
	if (!context) {
		throw new Error('useModalControl must be used within a ModalContext')
	}
	return context
}
