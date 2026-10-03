import { errorResponse, handle, isPublicLeague, json, options, parseId } from '@/sports/http'
import { getLeaders, LEADER_STATS, type LeaderStat } from '@/sports/service'

export const OPTIONS = options

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/sports/leagues/:id/leaders?stat=points&limit=20&minGames=1&perGame=1 */
export const GET = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = parseId((await params).id)
    if (!id || !(await isPublicLeague(id))) return errorResponse(404, 'Nije pronađeno')
    const q = new URL(req.url).searchParams
    const stat = (q.get('stat') ?? 'points') as LeaderStat
    if (!LEADER_STATS.includes(stat)) return errorResponse(400, `stat mora biti: ${LEADER_STATS.join(', ')}`)
    const limit = Math.min(Math.max(Number(q.get('limit') ?? 20) || 20, 1), 100)
    const minGames = Math.max(Number(q.get('minGames') ?? 1) || 1, 1)
    const perGame = q.get('perGame') !== '0'
    return json({ data: await getLeaders(id, { stat, limit, minGames, perGame }) }, { maxAge: 120 })
  })
