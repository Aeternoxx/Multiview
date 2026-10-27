import { useI18n } from '../i18n'
import {
  formatBitrate,
  formatCount,
  formatFps,
  formatJitter,
  formatResolution
} from '../lib/format'
import type { StreamStats } from '../lib/whep'

type StatsPanelProps = {
  stats: StreamStats | null
}

export function StatsPanel({ stats }: StatsPanelProps): React.JSX.Element {
  const { t } = useI18n()

  const rows: Array<[string, string]> = [
    [t('stats.bitrate'), formatBitrate(stats?.bitrateKbps ?? null)],
    [t('stats.fps'), formatFps(stats?.fps ?? null)],
    [t('stats.resolution'), formatResolution(stats?.width ?? null, stats?.height ?? null)],
    [t('stats.jitter'), formatJitter(stats?.jitterMs ?? null)],
    [t('stats.dropped'), formatCount(stats?.droppedFrames ?? null)]
  ]

  return (
    <div className="stats-panel">
      <dl>
        {rows.map(([label, value]) => (
          <div className="stats-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
