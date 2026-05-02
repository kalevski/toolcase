import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const InviteToastDemo = () => (
    <GcPage category="Social" title="gc-invite-toast" lede="Floating invite from a friend with accept / decline.">
        <GcSection title="Default">
            <gc-invite-toast eyebrow="Party Invite" sender="Lirien" sender-glyph="L" message="Join my party in Ravenmoor?" />
        </GcSection>
    </GcPage>
)

export default InviteToastDemo
