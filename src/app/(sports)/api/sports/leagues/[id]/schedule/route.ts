import { errorResponse, handle, isPublicLeague, json, options, parseId } from '@/sports/http'
import { getSchedule } from '@/sports/service'

export const OPTIONS = options

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/sports/leagues/:id/schedule?round=3&team=4417&status=finished|scheduled|live */
export const GET = (req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = parseId((await params).id)
    if (!id || !(await isPublicLeague(id))) return errorResponse(404, 'Nije pronađeno')
    const q = new URL(req.url).searchParams
    const round = q.get('round') ? Number(q.get('round')) : null
    const team = q.get('team') ? Number(q.get('team')) : null
    const status = q.get('status')

    const { matches } = await getSchedule(id)
    const data = matches.filter(
      (m) =>
        (round === null || m.round === round) &&
        (team === null || m.home.id === team || m.away.id === team) &&
        (!status || m.status === status),
    )
    const live = matches.some((m) => m.status === 'live')
    return json({ data, meta: { total: data.length, rounds: [...new Set(matches.map((m) => m.round).filter(Boolean))] } }, { maxAge: live ? 15 : 60 })
  })
