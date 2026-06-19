import React, { useEffect, useRef, useState } from 'react'

const DialogueBoxDemo: React.FC = () => {
    const choiceRef = useRef<any>(null)
    const advanceRef = useRef<any>(null)
    const [lastChoice, setLastChoice] = useState<string>('—')
    const [advanceCount, setAdvanceCount] = useState(0)

    // choices is a JS property (array) and tc-choice is a CustomEvent — both need a ref.
    useEffect(() => {
        const el = choiceRef.current
        if (!el) return
        el.choices = [
            { id: 'accept', label: 'Accept the quest' },
            { id: 'decline', label: 'Decline politely' },
            { id: 'locked', label: 'Ask for more gold', disabled: true },
        ]
        const onChoice = (e: any) => setLastChoice(e.detail.id)
        el.addEventListener('tc-choice', onChoice)
        return () => el.removeEventListener('tc-choice', onChoice)
    }, [])

    useEffect(() => {
        const el = advanceRef.current
        if (!el) return
        const onAdvance = () => setAdvanceCount((c) => c + 1)
        el.addEventListener('tc-advance', onAdvance)
        return () => el.removeEventListener('tc-advance', onAdvance)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DialogueBox"
                            description="NPC dialogue box with an optional speaker name and a typewriter body line. Click (or tap) the box to fast-forward the typing; once revealed, an empty-choice box advances on click and emits tc-advance, while a box with choices presents clickable options that emit tc-choice. Restyled to the design system — flat slate surface, sharp corners, 1px hairline border."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With speaker and advance indicator">
                                {/* @ts-ignore */}
                                <tc-dialogue-box
                                    ref={advanceRef}
                                    speaker="Captain Mara"
                                    text="The storm took out the eastern bridge. We'll have to find another way across before nightfall."
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Advanced {advanceCount} time{advanceCount === 1 ? '' : 's'}{' '}
                                    (click the box after it finishes typing).
                                </p>
                            </tc-section-card>

                            <tc-section-card title="With choices (choices JS property + tc-choice event)">
                                {/* @ts-ignore */}
                                <tc-dialogue-box
                                    ref={choiceRef}
                                    speaker="Guild Clerk"
                                    text="There's a bounty posted for the marsh wyrm. Interested?"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last choice: {lastChoice}
                                </p>
                            </tc-section-card>

                            <tc-section-card title="No speaker, faster typing (typing-speed)">
                                {/* @ts-ignore */}
                                <tc-dialogue-box
                                    typing-speed="60"
                                    text="A narrator's voice, unattributed, hurries the scene along at sixty characters a second."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DialogueBoxDemo
