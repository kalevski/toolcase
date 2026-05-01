import type Layer from '../../features/Layer'
import ProxyHandler from './ProxyHandler'

class CameraPositionHandler extends ProxyHandler<Layer> {

    set zoom(value: number) {
        if (this.ref !== null) this.ref.camera.setZoom(value)
    }

    get zoom(): number {
        return this.ref === null ? 1 : this.ref.camera.zoom
    }

    set x(value: number) {
        if (this.ref !== null) this.ref.camera.centerOnX(value)
    }

    get x(): number {
        if (this.ref === null) return 0
        return this.ref.camera.scrollX + this.ref.camera.centerX
    }

    set y(value: number) {
        if (this.ref !== null) this.ref.camera.centerOnY(value)
    }

    get y(): number {
        if (this.ref === null) return 0
        return this.ref.camera.scrollY + this.ref.camera.centerY
    }

}

export default class LayerHandler extends ProxyHandler<Layer> {

    camera: CameraPositionHandler = new CameraPositionHandler()

    protected proxyList: ProxyHandler<Layer>[] = [this.camera]

    set visible(value: boolean) {
        if (this.ref !== null) this.ref.visible = value
    }

    get visible(): boolean {
        return this.ref === null ? false : this.ref.visible
    }

    get childs(): number {
        return this.ref === null ? 0 : this.ref.list.length
    }

    set childs(_value: number) {}

}
