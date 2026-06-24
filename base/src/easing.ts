type EasingFn = (t: number) => number

const _c1 = 1.70158
const _c2 = _c1 * 1.525
const _c3 = _c1 + 1
const _c4 = (2 * Math.PI) / 3
const _c5 = (2 * Math.PI) / 4.5
const _n1 = 7.5625
const _d1 = 2.75

function _bounceOut(t: number): number {
    if (t < 1 / _d1) {
        return _n1 * t * t
    } else if (t < 2 / _d1) {
        t -= 1.5 / _d1
        return _n1 * t * t + 0.75
    } else if (t < 2.5 / _d1) {
        t -= 2.25 / _d1
        return _n1 * t * t + 0.9375
    } else {
        t -= 2.625 / _d1
        return _n1 * t * t + 0.984375
    }
}

function easeInSine(t: number): number {
    return 1 - Math.cos((t * Math.PI) / 2)
}

function easeOutSine(t: number): number {
    return Math.sin((t * Math.PI) / 2)
}

function easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2
}

function easeInQuad(t: number): number {
    return t * t
}

function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t)
}

function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function easeInCubic(t: number): number {
    return t * t * t
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeInQuart(t: number): number {
    return t * t * t * t
}

function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4)
}

function easeInOutQuart(t: number): number {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
}

function easeInQuint(t: number): number {
    return t * t * t * t * t
}

function easeOutQuint(t: number): number {
    return 1 - Math.pow(1 - t, 5)
}

function easeInOutQuint(t: number): number {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

function easeInExpo(t: number): number {
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10)
}

function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function easeInOutExpo(t: number): number {
    if (t === 0) return 0
    if (t === 1) return 1
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2
}

function easeInCirc(t: number): number {
    return 1 - Math.sqrt(1 - t * t)
}

function easeOutCirc(t: number): number {
    return Math.sqrt(1 - (t - 1) * (t - 1))
}

function easeInOutCirc(t: number): number {
    return t < 0.5
        ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
        : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2
}

function easeInBack(t: number): number {
    return _c3 * t * t * t - _c1 * t * t
}

function easeOutBack(t: number): number {
    return 1 + _c3 * Math.pow(t - 1, 3) + _c1 * Math.pow(t - 1, 2)
}

function easeInOutBack(t: number): number {
    return t < 0.5
        ? (Math.pow(2 * t, 2) * ((_c2 + 1) * 2 * t - _c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((_c2 + 1) * (2 * t - 2) + _c2) + 2) / 2
}

function easeInElastic(t: number): number {
    if (t === 0) return 0
    if (t === 1) return 1
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * _c4)
}

function easeOutElastic(t: number): number {
    if (t === 0) return 0
    if (t === 1) return 1
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * _c4) + 1
}

function easeInOutElastic(t: number): number {
    if (t === 0) return 0
    if (t === 1) return 1
    return t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * _c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * _c5)) / 2 + 1
}

function easeInBounce(t: number): number {
    return 1 - _bounceOut(1 - t)
}

function easeOutBounce(t: number): number {
    return _bounceOut(t)
}

function easeInOutBounce(t: number): number {
    return t < 0.5
        ? (1 - _bounceOut(1 - 2 * t)) / 2
        : (1 + _bounceOut(2 * t - 1)) / 2
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by

    function sampleX(t: number): number {
        return ((ax * t + bx) * t + cx) * t
    }

    function sampleY(t: number): number {
        return ((ay * t + by) * t + cy) * t
    }

    function solveCurveX(x: number): number {
        let t = x
        for (let i = 0; i < 8; i++) {
            const slope = (3 * ax * t + 2 * bx) * t + cx
            if (Math.abs(slope) < 1e-12) break
            t -= (sampleX(t) - x) / slope
        }
        if (t < 0 || t > 1) {
            let lo = 0
            let hi = 1
            t = x
            let cur = sampleX(t)
            while (Math.abs(cur - x) > 1e-7 && hi - lo > 1e-7) {
                if (cur > x) hi = t
                else lo = t
                t = (lo + hi) / 2
                cur = sampleX(t)
            }
        }
        return t
    }

    return (t: number): number => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        return sampleY(solveCurveX(t))
    }
}

export type { EasingFn }

export {
    easeInSine, easeOutSine, easeInOutSine,
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
    easeInBack, easeOutBack, easeInOutBack,
    easeInElastic, easeOutElastic, easeInOutElastic,
    easeInBounce, easeOutBounce, easeInOutBounce,
    cubicBezier
}

const Easing = {
    easeInSine, easeOutSine, easeInOutSine,
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
    easeInBack, easeOutBack, easeInOutBack,
    easeInElastic, easeOutElastic, easeInOutElastic,
    easeInBounce, easeOutBounce, easeInOutBounce,
    cubicBezier
}

export default Easing
