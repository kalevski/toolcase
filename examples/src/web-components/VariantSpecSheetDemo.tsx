import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const GTI_VARIANT = {
    powertrain: 'GASOLINE',
    fuelType: 'PETROL_SUPER',
    gearboxType: 'DUAL_CLUTCH',
    gears: 7,
    drivetrainType: 'FRONT',
    powerPs: 245,
    powerKw: 180,
    seats: 5,
    doors: 5,
    frontSuspension: 'SCREW',
    rearSuspension: 'SCREW',
    frontBrakes: 'DISC',
    rearBrakes: 'DISC',
    frontTyre: '225/40 R18',
    rearTyre: '225/40 R18',
    fuelCapacityL: 50,
    consumptionL100km: 6.5,
    consumptionCityL100km: 8.1,
    consumptionHwyL100km: 5.5,
    emissionStandard: 'WLTP',
    emissionCategory: 'Euro 6d',
    co2GKm: 149,
    lengthMm: 4287,
    widthMm: 1789,
    heightMm: 1463,
    wheelbaseMm: 2631,
    turningCircleDm: 109,
    trunkVolumeL: 374,
    roofLoadKg: 75,
    towingCapacityKg: 1600,
    maxSlopePct: 45,
    accelerationS: 6.2,
    topSpeedKmh: 250,
    noiseDb: 66,
}

// A sparse catalog row — most columns NULL. Absent values skip their rows;
// sections with zero rows disappear entirely.
const SPARSE_VARIANT = {
    powertrain: 'DIESEL',
    powerPs: 90,
    consumptionL100km: 4.5,
}

const VariantSpecSheetDemo: React.FC = () => {
    const fullRef = useTc<HTMLElement>({ variant: GTI_VARIANT })
    const sparseRef = useTc<HTMLElement>({ variant: SPARSE_VARIANT })
    const denseRef = useTc<HTMLElement>({ variant: GTI_VARIANT })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Variant Spec Sheet"
                            description="The full technical datasheet of one vehicle catalog row — header with name/version/slug/years, a hero strip of big mono dashboard readouts (power, 0–100, top speed, CO₂), then grouped key-value sections with dotted leader lines: Powertrain, Chassis, Dimensions, Consumption & Emissions. The `variant` object is a JS property; absent values skip their rows (unknown is NULL — no em-dash placeholders)."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full datasheet">
                                {/* @ts-ignore */}
                                <tc-variant-spec-sheet
                                    ref={fullRef}
                                    name="Golf GTI"
                                    version="2.0 TSI DSG"
                                    slug="vw-golf-8-gti-2-0-tsi-dsg"
                                    years-text="2020 – 2024"
                                />
                            </tc-section-card>

                            <tc-section-card title="Sparse row (NULL-skipping)">
                                <p className="text-muted small mb-3">
                                    Only three columns present — rows and whole sections without
                                    data are omitted, never rendered as placeholders.
                                </p>
                                <div style={{ maxWidth: '28rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-variant-spec-sheet
                                        ref={sparseRef}
                                        name="Corsa 1.5 D"
                                        slug="opel-corsa-f-1-5-d"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Dense">
                                <p className="text-muted small mb-3">
                                    <code>dense</code> tightens paddings for side-by-side
                                    comparison layouts.
                                </p>
                                {/* @ts-ignore */}
                                <tc-variant-spec-sheet
                                    ref={denseRef}
                                    dense
                                    name="Golf GTI"
                                    version="2.0 TSI DSG"
                                    years-text="2020 – 2024"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VariantSpecSheetDemo
