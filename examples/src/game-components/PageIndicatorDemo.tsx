import { useState } from 'react'
import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const PageIndicatorDemo = () => {
    const [index, setIndex] = useState(2)

    return (
        <GcPage category="Inputs" title="gc-page-indicator" lede="Pagination dots with active state and selection events.">
            <GcSection title="Interactive">
                <GcRow label="Default">
                    <gc-page-indicator
                        count="6"
                        index={index}
                        active-color="#ffd27a"
                        onSelect={(event: any) => setIndex(event.detail.index)}
                    />
                </GcRow>
            </GcSection>
        </GcPage>
    )
}

export default PageIndicatorDemo
