import { useModalControl } from './ModalContext'

export function useModalOpen<Payload = any, Input = any>(
	key: string,
	handlePayload?: (payload: Payload | null) => void,
): (input?: Input) => boolean {
	const modalControl = useModalControl()

	return (input?: Input) => {
		return modalControl.open(key, input, handlePayload)
	}
}

export function useModalClose<Payload = any>(key?: string): (payload?: Payload) => boolean {
	const modalControl = useModalControl()

	return (payload?: Payload) => {
		if (key) {
			return modalControl.close(key, payload)
		} else {
			const current = modalControl.current
			if (!current) {
				throw new Error(
					'useModalClose: No current modal to close. Either provide a key or call from within a modal.',
				)
			}
			return modalControl.close(undefined, payload)
		}
	}
}

export function useCurrentModal(): string | null {
	const modalControl = useModalControl()
	const current = modalControl.current
	return current ? current.key : null
}

export function useModalInput<Input = any>(): Input | null {
	const modalControl = useModalControl()
	const current = modalControl.current
	return current ? current.input : null
}

export function useModalCloseAll(): () => void {
	const modalControl = useModalControl()

	return () => {
		modalControl.closeAll()
	}
}
