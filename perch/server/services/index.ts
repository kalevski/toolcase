// Service layer — policy / business rules. Each service is server-only and is
// the sole caller of the repositories beneath it. No services yet; this file
// only marks the layer and the `server-only` guard convention.
// See notes/static-hosting-app-design.md §5, §13.

import 'server-only'

export {}
