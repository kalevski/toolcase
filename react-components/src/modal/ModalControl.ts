import { Broadcast } from '@toolcase/base'

export type ModalDef = {
	key: string
	input: any
	handlePayload?: (payload: any) => void
}

export const CHANGE_EVENT = 'change'

export class ModalControl extends Broadcast {
	private defs: ModalDef[] = []

	get current(): ModalDef | null {
		return this.defs.length > 0 ? this.defs[this.defs.length - 1] : null
	}

	open(key: string, input?: any, handlePayload?: (payload: any) => void): boolean {
		if (this.defs.some((def) => def.key === key)) {
			return false
		}

		this.defs.push({
			key,
			input,
			handlePayload,
		})

		this.emit(CHANGE_EVENT)
		return true
	}

	close(key?: string, payload?: any): boolean {
		if (key) {
			const index = this.defs.findIndex((def) => def.key === key)
			if (index === -1) {
				return false
			}

			const def = this.defs[index]
			this.defs.splice(index, 1)

			if (def.handlePayload) {
				def.handlePayload(payload || null)
			}

			this.emit(CHANGE_EVENT)
			return true
		} else {
			if (this.defs.length === 0) {
				return false
			}

			const def = this.defs.pop()!

			if (def.handlePayload) {
				def.handlePayload(payload || null)
			}

			this.emit(CHANGE_EVENT)
			return true
		}
	}

	getAll(): ModalDef[] {
		return [...this.defs]
	}

	isOpen(key: string): boolean {
		return this.defs.some((def) => def.key === key)
	}

	closeAll(): void {
		const modalsToClose = [...this.defs]
		this.defs = []

		modalsToClose.forEach((def) => {
			if (def.handlePayload) {
				def.handlePayload(null)
			}
		})

		this.emit(CHANGE_EVENT)
	}
}
