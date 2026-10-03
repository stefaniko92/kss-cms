import { errorResponse, handle, isPublicLeague, json, options, parseId } from '@/sports/http'
import { getStandings } from '@/sports/service'

export const OPTIONS = options

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/sports/leagues/:id/standings */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = parseId((await params).id)
    if (!id || !(await isPublicLeague(id))) return errorResponse(404, 'Nije pronađeno')
    return json({ data: await getStandings(id) }, { maxAge: 60 })
  })
