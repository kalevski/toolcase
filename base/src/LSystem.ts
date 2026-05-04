interface LSystemConfig {
    axiom: string
    rules: Record<string, string>
}

class LSystem {

    private config: LSystemConfig

    private _state: string

    private _iteration: number = 0

    constructor(config: LSystemConfig) {
        this.config = config
        this._state = config.axiom
    }

    get state(): string {
        return this._state
    }

    get iteration(): number {
        return this._iteration
    }

    iterate(): string {
        let sequence = ''
        for (const rule of this._state.split('')) {
            const resolved = this.config.rules[rule]
            if (typeof resolved !== 'string') {
                sequence += rule
                continue
            }
            sequence += resolved
        }
        this._iteration++
        this._state = sequence
        return sequence
    }
}

export default LSystem
