import { errorResponse, handle, isPublicLeague, json, options, parseId } from '@/sports/http'
import { getSchedule } from '@/sports/service'

export const OPTIONS = options

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/sports/leagues/:id → liga i timovi */
export const GET = (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = parseId((await params).id)
    if (!id || !(await isPublicLeague(id))) return errorResponse(404, 'Nije pronađeno')
    const { league, teams } = await getSchedule(id)
    return json({ data: { ...league, teams } }, { maxAge: 120 })
  })
