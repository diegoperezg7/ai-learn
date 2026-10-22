/** Recharts wrappers that follow the app's theme tokens. */

import { useMemo } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Pie, PieChart, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { usePrefs, useT } from '../store/useStore'

/**
 * Recharts needs resolved colour values, not `var(--accent)`, so lee los tokens
 * del documento en vez de duplicarlos aqui. Asi la paleta vive en un solo sitio.
 */
const TOKENS = {
  accent: '--accent',
  grid: '--border',
  axis: '--text-dim',
  text: '--text',
  surface: '--surface',
  border: '--border',
  success: '--success',
  warning: '--warning',
  danger: '--danger',
  muted: '--border-strong',
} as const

type ChartTheme = { dark: boolean } & Record<keyof typeof TOKENS, string>

export function useChartTheme(): ChartTheme {
  const theme = usePrefs((s) => s.theme)
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    const read = (name: string) => css.getPropertyValue(name).trim()
    const out = { dark: theme === 'dark' } as ChartTheme
    for (const [key, token] of Object.entries(TOKENS)) {
      out[key as keyof typeof TOKENS] = read(token)
    }
    return out
  }, [theme])
}

function useTooltipStyle() {
  const c = useChartTheme()
  return {
    contentStyle: {
      background: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      fontSize: 12,
      color: c.text,
      boxShadow: '0 4px 20px rgba(0,0,0,.25)',
    },
    labelStyle: { color: c.text, fontWeight: 600 },
    itemStyle: { color: c.text },
  }
}

const AXIS = { fontSize: 11 }

/** Recharts tipa los valores del tooltip como una union amplia. */
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0))

/* ------------------------------------------------------------------ weekly hours */

export interface WeekPoint { label: string; target: number; actual: number }

export function WeeklyHoursChart({ data, height = 220 }: { data: WeekPoint[]; height?: number }) {
  const c = useChartTheme()
  const tip = useTooltipStyle()
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ ...AXIS, fill: c.axis }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...AXIS, fill: c.axis }} axisLine={false} tickLine={false} unit="h" />
        <Tooltip {...tip} formatter={(v, n) => [`${num(v)} h`, n === 'actual' ? t('chart.actual') : t('chart.target')]} />
        <Bar dataKey="actual" name="actual" radius={[8, 8, 8, 8]} maxBarSize={26}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.actual >= d.target ? c.success : d.actual > 0 ? c.warning : c.muted} />
          ))}
        </Bar>
        <Line
          type="stepAfter" dataKey="target" name="target" stroke={c.accent}
          strokeWidth={2} strokeDasharray="4 4" dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ distribution donut */

export interface SharePoint { name: string; value: number; target?: number; color: string }

export function DistributionChart({ data, height = 230 }: { data: SharePoint[]; height?: number }) {
  const c = useChartTheme()
  const tip = useTooltipStyle()
  const t = useT()
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          innerRadius="58%" outerRadius="82%" paddingAngle={3} cornerRadius={8}
          stroke={c.surface} strokeWidth={2}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip
          {...tip}
          formatter={(v, n, item) => {
            const value = num(v)
            const target = (item?.payload as SharePoint | undefined)?.target
            const pct = Math.round((value / total) * 100)
            return [`${pct}% · ${value} h${target != null ? ` (${t('chart.targetPct', { n: target })})` : ''}`, String(n)]
          }}
        />
        <Legend
          verticalAlign="bottom" height={44} iconType="circle" iconSize={8}
          formatter={(value) => <span style={{ color: c.text, fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ skills radar */

export interface RadarPoint { area: string; actual: number; target: number }

export function SkillRadar({ data, height = 260 }: { data: RadarPoint[]; height?: number }) {
  const c = useChartTheme()
  const tip = useTooltipStyle()
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={c.grid} />
        <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: c.axis }} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
        <Radar
          name={t('chart.target')} dataKey="target" stroke={c.axis} strokeWidth={1.5}
          strokeDasharray="4 3" fill={c.axis} fillOpacity={0.1}
        />
        <Radar name={t('chart.now')} dataKey="actual" stroke={c.accent} fill={c.accent} fillOpacity={0.42} />
        <Tooltip {...tip} formatter={(v, n) => [`${num(v).toFixed(1)} / 5`, String(n)]} />
        <Legend
          iconType="circle" iconSize={8}
          formatter={(value) => <span style={{ color: c.text, fontSize: 12 }}>{value}</span>}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ cumulative hours */

export interface CumulativePoint { label: string; real: number | null; plan: number }

export function CumulativeChart({ data, height = 230 }: { data: CumulativePoint[]; height?: number }) {
  const c = useChartTheme()
  const tip = useTooltipStyle()
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="realFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.accent} stopOpacity={0.42} />
            <stop offset="100%" stopColor={c.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ ...AXIS, fill: c.axis }} axisLine={false} tickLine={false} />
        <YAxis tick={{ ...AXIS, fill: c.axis }} axisLine={false} tickLine={false} unit="h" />
        <Tooltip {...tip} formatter={(v, n) => [`${num(v)} h`, n === 'real' ? t('chart.cumulativeActual') : t('chart.plan')]} />
        <Area type="monotone" dataKey="plan" name="plan" stroke={c.muted} strokeDasharray="4 4" fill="none" strokeWidth={2} />
        <Area
          type="monotone" dataKey="real" name="real" stroke={c.accent} strokeWidth={2.5}
          fill="url(#realFill)" connectNulls={false}
          dot={{ r: 2.5, fill: c.accent, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ interview readiness */

export interface AreaReadiness { area: string; ready: number; pending: number }

export function ReadinessChart({ data, height = 260 }: { data: AreaReadiness[]; height?: number }) {
  const c = useChartTheme()
  const tip = useTooltipStyle()
  const t = useT()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 10, left: 8, bottom: 0 }} barSize={16}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis type="number" tick={{ ...AXIS, fill: c.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category" dataKey="area" width={120}
          tick={{ fontSize: 11, fill: c.axis }} axisLine={false} tickLine={false}
        />
        <Tooltip {...tip} formatter={(v, n) => [num(v), n === 'ready' ? t('iv.ready') : t('iv.notReady')]} />
        <Bar dataKey="ready" name="ready" stackId="a" fill={c.success} radius={[8, 8, 8, 8]} />
        <Bar dataKey="pending" name="pending" stackId="a" fill={c.muted} radius={[8, 8, 8, 8]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
