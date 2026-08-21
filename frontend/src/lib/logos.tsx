/**
 * Brand logos with transparent background.
 *
 * Real tool logos come from simple-icons as single-path SVGs (no background, no
 * bounding box), so they sit cleanly on any surface in light and dark mode.
 * Abstract concepts (RAG, System Design, ...) fall back to a lucide glyph.
 */

import {
  Activity, BadgeCheck, Brain, BrainCircuit, Building2, Cloud, DraftingCompass,
  FunctionSquare, Gauge, Layers3, LibraryBig, Map as MapIcon, Minimize2, Network,
  Plug, SearchCode, ServerCog, Share2, SlidersHorizontal, Waypoints,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as si from 'simple-icons'

interface SimpleIcon { path: string; hex: string; title: string }

const BRAND: Record<string, SimpleIcon> = {
  python: si.siPython,
  langchain: si.siLangchain,
  langgraph: si.siLangchain, // LangGraph has no separate mark in simple-icons
  fastapi: si.siFastapi,
  pytest: si.siPytest,
  postgresql: si.siPostgresql,
  docker: si.siDocker,
  githubactions: si.siGithubactions,
  github: si.siGithub,
  pytorch: si.siPytorch,
  huggingface: si.siHuggingface,
  typescript: si.siTypescript,
  react: si.siReact,
  ollama: si.siOllama,
  coursera: si.siCoursera,
  youtube: si.siYoutube,
  exercism: si.siExercism,
  redis: si.siRedis,
  openai: si.siOpenai,
}

const CONCEPT: Record<string, LucideIcon> = {
  'library-big': LibraryBig,
  'vector-square': Waypoints,
  'search-code': SearchCode,
  'building-2': Building2,
  'drafting-compass': DraftingCompass,
  'server-cog': ServerCog,
  network: Network,
  'share-2': Share2,
  cloud: Cloud,
  activity: Activity,
  'function-square': FunctionSquare,
  'brain-circuit': BrainCircuit,
  'layers-3': Layers3,
  gauge: Gauge,
  'sliders-horizontal': SlidersHorizontal,
  'minimize-2': Minimize2,
  map: MapIcon,
  'badge-check': BadgeCheck,
  plug: Plug,
  brain: Brain,
}

/** Brand hex is unreadable on dark backgrounds for near-black marks. */
const DARK_MARKS = new Set(['ollama', 'github', 'langchain', 'langgraph'])

export function iconColor(key: string, dark: boolean): string {
  const [kind, name] = key.split(':')
  if (kind === 'si' && BRAND[name]) {
    if (dark && DARK_MARKS.has(name)) return '#e8eef7'
    return `#${BRAND[name].hex}`
  }
  return 'currentColor'
}

interface LogoProps {
  icon: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
  dark?: boolean
  chip?: boolean
  title?: string
}

export function Logo({ icon, size = 'md', color, dark = false, chip = true, title }: LogoProps) {
  const [kind, name] = (icon || 'lu:brain').split(':')
  const fill = color ?? iconColor(icon, dark)

  let glyph: React.ReactNode
  if (kind === 'si' && BRAND[name]) {
    const mark = BRAND[name]
    glyph = (
      <svg viewBox="0 0 24 24" role="img" aria-label={title ?? mark.title} fill={fill}>
        <path d={mark.path} />
      </svg>
    )
  } else {
    const Glyph = CONCEPT[name] ?? Brain
    glyph = <Glyph strokeWidth={2} style={{ color: color ?? 'var(--accent)' }} aria-label={title} />
  }

  if (!chip) return <>{glyph}</>
  return <span className={`logo-chip ${size === 'md' ? '' : size}`}>{glyph}</span>
}
