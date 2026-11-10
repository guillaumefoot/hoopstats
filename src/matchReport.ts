import { lineupAfterRotation, remainingClockMs, shotPoints, summarize } from './basket.ts'
import type { Match, MatchEvent } from './basket.ts'

type Score = { ours: number; opponent: number }

export function periodLabel(quarter: number) {
  return quarter <= 4 ? `Q${quarter}` : `P${quarter - 4}`
}

export function buildMatchReport(match: Match, now = Date.now()) {
  const periodCount = match.events.reduce((last, event) => Math.max(last, event.quarter), match.quarter)
  const periods = Array.from({ length: periodCount }, () => ({ ours: 0, opponent: 0 }))
  const offsets: number[] = []
  let totalDuration = 0
  let timelineKnown = true
  let minutesKnown = true
  for (const [index] of periods.entries()) {
    const clock = match.periodClocks?.[index + 1]
    offsets.push(totalDuration)
    if (!clock?.durationMs) {
      timelineKnown = false
      minutesKnown = false
      continue
    }
    totalDuration += clock.durationMs
    if (index + 1 < periodCount && remainingClockMs(clock, now) > 0) minutesKnown = false
  }

  function elapsedAt(event: MatchEvent) {
    const duration = match.periodClocks?.[event.quarter]?.durationMs
    if (!timelineKnown || duration === undefined || event.clockRemainingMs === undefined || event.clockRemainingMs > duration) return null
    return offsets[event.quarter - 1] + duration - event.clockRemainingMs
  }

  let lineup = match.starters
  let score: Score = { ours: 0, opponent: 0 }
  let lastRotationTime = 0
  const plusMinus = Object.fromEntries(match.roster.map(({ id }) => [id, 0]))
  const playingTime = Object.fromEntries(match.roster.map(({ id }) => [id, 0]))
  const flow: { elapsed: number | null; score: Score }[] = []

  const playByPlay = match.events.map((event) => {
    if (event.type === 'rotation') {
      const elapsed = elapsedAt(event)
      if (elapsed === null || elapsed < lastRotationTime) minutesKnown = false
      if (minutesKnown && elapsed !== null) {
        for (const id of lineup) playingTime[id] += elapsed - lastRotationTime
        lastRotationTime = elapsed
      }
      lineup = lineupAfterRotation(lineup, event)
    } else if (event.type === 'shot' && event.result === 'made') {
      const points = shotPoints(event)
      score = { ...score, [event.team]: score[event.team] + points }
      periods[event.quarter - 1][event.team] += points
      const delta = event.team === 'ours' ? points : -points
      for (const id of lineup) plusMinus[id] += delta
      flow.push({ elapsed: elapsedAt(event), score })
    }
    return { event, score }
  })

  const finalClock = match.periodClocks?.[periodCount]
  const elapsedGame = totalDuration - (finalClock ? remainingClockMs(finalClock, now) : 0)
  if (minutesKnown && elapsedGame >= lastRotationTime) {
    for (const id of lineup) playingTime[id] += elapsedGame - lastRotationTime
  } else {
    minutesKnown = false
  }

  const timedFlow = timelineKnown && flow.every(({ elapsed }, index) =>
    elapsed !== null && (index === 0 || elapsed >= (flow[index - 1].elapsed ?? 0)))
  return {
    ...summarize(match), periods, score, playByPlay, plusMinus,
    playingTime: minutesKnown ? playingTime : null,
    flow: flow.map(({ elapsed, score: current }, index) => ({ x: timedFlow ? elapsed! / 60_000 : index + 1, ...current })),
    flowEnd: timedFlow ? Math.max(elapsedGame / 60_000, (flow.at(-1)?.elapsed ?? 0) / 60_000) : flow.length,
    timedFlow,
  }
}
