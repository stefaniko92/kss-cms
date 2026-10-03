import { errorResponse, handle, json, options } from '@/sports/http'
import { getAllLeagues, getLeagueGroups } from '@/sports/service'

export const OPTIONS = options

/** GET /api/sports/leagues            → grupisano po kategorijama (tekuće lige)
 *  GET /api/sports/leagues?all=1      → sve vidljive lige, uključujući prošle sezone */
export const GET = (req: Request) =>
  handle(async () => {
    const all = new URL(req.url).searchParams.get('all')
    if (all) return json({ data: (await getAllLeagues()).filter((l) => l.visible) }, { maxAge: 600 })
    return json({ data: await getLeagueGroups() }, { maxAge: 600 })
  }).catch(() => errorResponse(500, 'Greška'))
