import { errorResponse, handle, isPublicLeague, json, options, parseId } from '@/sports/http'
import { getMatch } from '@/sports/service'

export const OPTIONS = options

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/sports/matches/:id → box score + play-by-play */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = parseId((await params).id)
    if (!id) return errorResponse(404, 'Nije pronađeno')
    const match = await getMatch(id)
    if (!(await isPublicLeague(match.leagueId))) return errorResponse(404, 'Nije pronađeno')
    return json({ data: match }, { maxAge: match.status === 'finished' ? 3600 : match.status === 'live' ? 10 : 60 })
  })
