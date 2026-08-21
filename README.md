<div align="center">

# AI Mastery Hub

**El sistema operativo de mi carrera técnica como AI Engineer.**
Qué toca hoy, cuánto llevo de verdad, qué skills flojean y un currículum que solo crece con evidencia.

<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
<img src="https://img.shields.io/badge/FastAPI-0.120-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
<img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/Docker-compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">

<img src="https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy">
<img src="https://img.shields.io/badge/Pydantic-v2-E92063?style=flat-square&logo=pydantic&logoColor=white" alt="Pydantic">
<img src="https://img.shields.io/badge/SQLite-WAL-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite">
<img src="https://img.shields.io/badge/nginx-alpine-009639?style=flat-square&logo=nginx&logoColor=white" alt="nginx">
<img src="https://img.shields.io/badge/Ollama-local-000000?style=flat-square&logo=ollama&logoColor=white" alt="Ollama">
<img src="https://img.shields.io/badge/Recharts-3.10-22B5BF?style=flat-square" alt="Recharts">
<img src="https://img.shields.io/badge/Zustand-5-443E38?style=flat-square" alt="Zustand">
<img src="https://img.shields.io/badge/CSS-sin_Tailwind-1572B6?style=flat-square&logo=css&logoColor=white" alt="CSS propio">

</div>

---

## Por qué existe

No es un gestor de tareas ni una lista de cursos. Es la herramienta de uso diario del
**AI Engineer Mastery Roadmap 2026**: 12 semanas de sprint (21 ago → 29 nov) más una fase
de modelos hasta el 31 de diciembre, a **6 h por semana**, con un día libre obligatorio.

Tres reglas que la aplicación hace cumplir por diseño:

| Regla | Cómo la aplica la app |
|---|---|
| **La unidad de trabajo es la sesión, no la tarea** | 95 sesiones concretas repartidas por día, cada una con su alcance exacto y dónde parar. "Aprender RAG" no dice qué hacer un martes; "Módulo 2, primera mitad, hasta terminar BM25" sí |
| **Evidencia, no cursos terminados** | Cada skill tiene su `Completion Criteria`. El nivel sube por lo que construyes, y solo entonces el CV propone una línea nueva |
| **Consistencia, no burnout** | 6 h/semana repartidas en 45/60/45/60/120 min + review. Si registras 7 días seguidos, la app te avisa de que descanses |

<div align="center">
<img src="docs/dashboard-light.png" width="49%" alt="Dashboard en claro">
<img src="docs/dashboard-dark.png" width="49%" alt="Dashboard en oscuro">
</div>

---

## Qué hace

| Área | Detalle |
|---|---|
| **Dashboard** | Abre con la sesión de hoy y su alcance exacto. Debajo: horas de la semana, ritmo, racha, días al deadline y lo que queda de semana |
| **Plan diario** | 95 sesiones sobre el calendario real. Marcar una sesión registra sus minutos automáticamente |
| **Roadmap** | Ordenado por semanas, S1 primero, con el plan día a día dentro de cada una. Pestañas aparte para diciembre y para lo opcional |
| **Gráficos** | Horas por semana, acumulado vs plan, radar de nivel por pilar, donut de reparto, entrevistas por área y práctica vs teoría |
| **Timeline** | Gantt de agosto a diciembre con línea de "hoy" |
| **Calendario** | Mes navegable; al pulsar un día salen sus sesiones |
| **Skills** | 30 competencias con descripción, por qué importa, criterio de completion, nivel 0–5, evidencia y logo oficial |
| **Recursos** | 23 recursos verificados con logo, precio, horas reales y veredicto de por qué entra o se descarta |
| **Entrevistas** | 60 preguntas con doble check (*sé explicarlo* / *sé implementarlo*) y repetición espaciada |
| **Currículum** | CV vivo en markdown. Propone líneas cuando hay evidencia real; nada entra sin que lo aceptes |
| **Reviews** | Una entrada por semana con horas reales vs objetivo |
| **Coach IA** | Ollama local en tres roles: coach, entrevistador y code reviewer. Nunca escribe la solución |
| **Notificaciones** | Deadlines, atrasos, ritmo, review pendiente, hitos de racha y aviso de descanso |

Todo en **español e inglés**, con **tema claro/oscuro** y **responsive** para usarla desde el móvil.

<div align="center">
<img src="docs/progress-dark.png" width="62%" alt="Gráficos">
<img src="docs/mobile-dark.png" width="18%" alt="Vista móvil">
</div>

---

## Arquitectura

```mermaid
flowchart LR
    subgraph cliente[" "]
        NAV["Navegador · escritorio y móvil"]
    end

    subgraph portal["Mac Mini · darc3.com"]
        CF["Cloudflare Tunnel"] --> CADDY["Caddy · forward_auth"]
        CADDY --> SSO["AIdentity SSO<br/>inyecta X-Auth-User / Email / Role"]
    end

    subgraph stack["docker compose"]
        WEB["hub-web<br/>nginx + React SPA"]
        API["hub-api<br/>FastAPI"]
        DB[("SQLite · volumen hub-data<br/>WAL + foreign keys")]
    end

    OLLAMA["Ollama en el host<br/>coach / entrevistador / reviewer"]

    NAV --> CF
    NAV -.->|LAN o Tailscale| WEB
    SSO --> WEB
    WEB -->|proxy /api| API
    API --> DB
    API -.->|opcional| OLLAMA
```

- **hub-web** sirve el build estático y hace de proxy de `/api` hacia `hub-api`, así que el
  navegador solo habla con un origen y no hay CORS en producción.
- **hub-api** no se expone al exterior: solo es alcanzable dentro de la red de compose.
- Detrás del portal, la API **exige** las cabeceras `X-Auth-*` que inyecta AIdentity.

### Modelo de datos

```mermaid
erDiagram
    SKILL      ||--o{ TASK          : "se demuestra con"
    SKILL      ||--o{ RESOURCE      : "se estudia con"
    SKILL      ||--o{ INTERVIEW_Q   : "se pregunta en"
    TASK       ||--o{ CHECKLIST     : "se trocea en"
    TASK       ||--o{ DAY_PLAN      : "se planifica como"
    TASK       ||--o{ STUDY_SESSION : "consume"
    RESOURCE   ||--o{ DAY_PLAN      : "alimenta"
    DAY_PLAN   ||--o| STUDY_SESSION : "al completarse registra"
    WEEK_REVIEW ||--o{ STUDY_SESSION : "agrega"
    CV_DOC     ||--o{ CV_SUGGESTION : "recibe"

    SKILL { int id string name int current_level int target_level string completion_criteria string evidence }
    TASK { int id string title string category int week date start date deadline string status string deliverable }
    DAY_PLAN { int id date day int week int slot string title string scope int minutes string mode bool done }
    STUDY_SESSION { int id date day int minutes string mode string notes }
    INTERVIEW_Q { int id string area bool can_explain bool can_implement date next_review int interval_days }
```

> **Una sola fuente de verdad para las horas: `study_sessions`.** Ritmo, racha, gráficos y
> reviews se derivan de ahí. Ninguna pantalla guarda su propio contador.

### El calendario del sprint

```mermaid
gantt
    title AI Engineer Mastery Roadmap 2026
    dateFormat YYYY-MM-DD
    axisFormat %b

    section Sprint 12w
    S1  Python + LangChain + CI/CD   :2026-08-21, 6d
    S2  RAG Fundamentals             :2026-08-27, 7d
    S3  Advanced Retrieval           :2026-09-03, 7d
    S4  Software Architecture        :2026-09-10, 7d
    S5  Software Design + FastAPI    :2026-09-17, 7d
    S6  Backend + Reliability        :2026-09-24, 7d

    section Pausa
    Tailandia + Vietnam              :crit, 2026-10-01, 18d

    section Sprint 12w
    S7  LangGraph                    :2026-10-19, 7d
    S8  System Design                :2026-10-26, 7d
    S9  Cloud + Containers           :2026-11-02, 7d
    S10 CI/CD + Observability        :2026-11-09, 7d
    S11 Evals + LLMOps               :2026-11-16, 7d
    S12 Consolidación                :2026-11-23, 7d

    section Models
    Diciembre  Models & Advanced AI  :2026-11-30, 32d
```

---

## Stack

| Capa | Tecnología | Por qué |
|:--|:--|:--|
| <img src="https://cdn.simpleicons.org/fastapi/009688" width="16"> **API** | FastAPI + Pydantic v2 | Contrato tipado y `/docs` gratis |
| <img src="https://cdn.simpleicons.org/sqlalchemy/D71F00" width="16"> **ORM** | SQLAlchemy 2.0 | Estilo `select()` moderno, sin *legacy Query* |
| <img src="https://cdn.simpleicons.org/sqlite/003B57" width="16"> **DB** | SQLite con WAL | Un solo usuario. Postgres sería sobreingeniería |
| <img src="https://cdn.simpleicons.org/react/61DAFB" width="16"> **UI** | React 19 + react-router 7 | — |
| <img src="https://cdn.simpleicons.org/vite/646CFF" width="16"> **Build** | Vite 6 + TypeScript strict | — |
| **Estado** | Zustand 5 con `persist` | Tema e idioma sobreviven al reload |
| **Gráficos** | Recharts 3 | Composable y sin canvas |
| <img src="https://cdn.simpleicons.org/css/1572B6" width="16"> **Estilos** | CSS propio con variables | **Sin Tailwind**, por decisión |
| <img src="https://cdn.simpleicons.org/simpleicons/111111" width="16"> **Logos** | simple-icons + lucide-react | SVG de una ruta y sin fondo; lucide para los conceptos abstractos |
| <img src="https://cdn.simpleicons.org/docker/2496ED" width="16"> **Runtime** | Docker Compose multi-stage | — |
| <img src="https://cdn.simpleicons.org/nginx/009639" width="16"> **Servidor** | nginx alpine | Sirve el SPA y proxya `/api` |
| <img src="https://cdn.simpleicons.org/ollama/000000" width="16"> **LLM** | Ollama en el host | Local, sin coste y sin salir de casa |

---

## Arranque

### Docker (lo normal)

```bash
cp .env.example .env
docker compose up -d --build
```

Abre **http://localhost:5183**. Los datos persisten en el volumen `hub-data`.

### Desarrollo local

Requiere Python 3.12+ y Node 20+.

```bash
# Backend
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --reload --port 8183

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5183 |
| API | http://localhost:8183/api/health |
| OpenAPI | http://localhost:8183/docs |

La base de datos se crea sola en `backend/data/hub.db` y se siembra en el primer arranque.
El seed es **idempotente**: reiniciar no duplica nada.

### Despliegue en el Mac Mini (portal darc3)

```mermaid
sequenceDiagram
    participant U as Navegador
    participant CF as Cloudflare Tunnel
    participant C as Caddy
    participant A as AIdentity
    participant W as hub-web
    participant API as hub-api

    U->>CF: GET hub.darc3.com
    CF->>C: reenvía
    C->>A: forward_auth
    A-->>C: 200 + X-Auth-User / Email / Role
    C->>W: request con cabeceras
    W->>API: proxy /api/*
    API-->>W: 200 (o 401 si faltan cabeceras)
    W-->>U: SPA + datos
```

```bash
docker compose -f docker-compose.yml -f docker-compose.portal.yml up -d --build
/add-to-portal
```

El override conecta ambos contenedores a la red `auth-proxy_default` y activa
`REQUIRE_PORTAL_AUTH=true`. El último paso, dar de alta el public hostname `hub.darc3.com`
en Cloudflare Zero Trust, **es manual**.

---

## Configuración

Todo por variables de entorno, ver `.env.example`:

| Variable | Por defecto | Para qué |
|---|---|---|
| `WEB_PORT` | `5183` | Puerto expuesto del frontend |
| `REQUIRE_PORTAL_AUTH` | `false` | `true` detrás del auth-proxy |
| `SPRINT_START` | `2026-08-21` | Inicio del sprint |
| `CORE_DEADLINE` | `2026-11-29` | Cierre del núcleo (con la pausa de Tailandia + Vietnam, 1–18 oct) |
| `FINAL_DEADLINE` | `2026-12-31` | Fin de la fase de modelos |
| `WEEKLY_TARGET_HOURS` | `6` | Objetivo semanal |
| `COACH_ENABLED` | `true` | Activa el coach |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Ollama del host |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Modelo del coach |

---

## API

Todo bajo el prefijo `/api`. Lo más usado:

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/dashboard` | El agregado que pinta la portada: hoy, ritmo, racha, horas por semana |
| `GET` | `/days?start=&end=` | Sesiones del rango |
| `POST` | `/days/{id}/complete` | Marca la sesión **y registra sus minutos**, en una sola llamada |
| `GET · POST` | `/sessions` | Horas registradas a mano |
| `GET` | `/sessions/heatmap` | Actividad por día |
| `GET · PATCH` | `/skills` · `/skills/{id}` | Nivel y evidencia; el estado se deriva del nivel |
| `GET · PATCH` | `/tasks` · `/tasks/{id}` | Estado, foco del día, horas |
| `PATCH` | `/questions/{id}` | Doble check y reprogramación de la repetición espaciada |
| `GET · PUT` | `/cv` | CV vivo en markdown |
| `POST` | `/cv/suggestions/sync` | Busca evidencia nueva y propone líneas |
| `POST` | `/coach/chat` | Coach local, en modo entrenamiento |
| `POST` | `/notifications/refresh` | Reevalúa las 7 reglas |

Contrato completo en `/docs`.

---

## Metodología

Práctica deliberada (Ericsson) + *retrieval practice* + repetición espaciada.

```mermaid
flowchart LR
    P["Sesión con alcance cerrado"] --> H["Registra minutos"]
    H --> E{"¿Hay entregable?"}
    E -->|sí| S["Sube el nivel de la skill"]
    E -->|no| P
    S --> C["El CV propone una línea"]
    C --> A{"¿La aceptas?"}
    A -->|sí| CV["Entra en el currículum"]
    A -->|no| X["Se descarta"]
    H --> R["Weekly Review"]
    R --> P
```

**Repetición espaciada de las 60 preguntas**: si puedes explicarla *e* implementarla, el
intervalo se duplica; si fallas cualquiera de las dos, vuelve mañana y el intervalo se
reinicia a 1 día.

**Modos de trabajo**. En *PRODUCTION* la IA escribe código sin límite. En *TRAINING* —el
modo del coach de esta app— la IA explica, pregunta, revisa y hace de entrevistador, pero
**nunca** escribe la solución. La dinámica es *yo pienso → yo escribo → la IA revisa*.

---

## Estructura

```
backend/app/
  main.py            arranque, CORS, routers, seed en el lifespan
  config.py          settings por entorno
  models.py          15 tablas
  schemas.py         contrato de la API
  dependencies.py    auth por cabeceras del portal
  seed_plan.py       17 semanas, 74 tareas, 60 preguntas
  seed_days.py       95 sesiones diarias con su alcance
  seed_data.py       30 skills y 23 recursos
  seed.py            siembra idempotente
  routers/           skills · tasks · tracking · growth
  services/          progress · cv_builder · notifier · coach
frontend/src/
  pages/             Dashboard · Roadmap · Plan · Progress · Skills · Resources ·
                     Interview · CV · Reviews · Coach
  components/        ui.tsx · TaskCard.tsx · DaySession.tsx · charts.tsx
  lib/               api.ts · logos.tsx
  store/             zustand (prefs + datos)
  i18n/              ES / EN
  styles/            tokens.css · global.css
docs/                capturas del README
```

---

## Currículum

En el primer arranque el CV se importa de la primera fuente que exista:

1. `/app/import/cv.md` (montado desde `backend/import/`)
2. `~/career-ops/cv.md`
3. Una plantilla vacía

> El CV real **no está en el repo** (`backend/import/cv.md` está en `.gitignore`). Deja ahí
> tu markdown antes del primer arranque y la app lo adopta.

A partir de ahí vive en la base de datos. La app propone líneas nuevas cuando una skill
llega a nivel 4+ o *Interview Ready*, o cuando completas una tarea con entregable.
**Nada entra en el CV sin que lo aceptes.**

---

## Notas y gotchas

- **La distribución por pilar se calcula solo sobre el sprint de 12 semanas**, que es donde
  aplica el reparto 40 / 30 / 20 / 10. Diciembre es deliberadamente *Models* y desvirtuaría
  el dato; las tareas de relleno opcional tampoco cuentan.
- **`seed_days` corta si ya hay filas en `day_plans`.** Para resembrar el plan diario hay que
  borrarlas primero y después reiniciar el contenedor.
- **nginx tiene que escuchar también en IPv6** (`listen [::]:80`). Dentro del contenedor
  `localhost` resuelve antes a `::1`, así que sin eso el healthcheck falla aunque la web
  responda perfectamente.
- **Recharts necesita colores reales, no `var(--accent)`.** Por eso existe `useChartTheme()`.
- **Python 3.14 todavía no tiene wheels de pydantic-core** en algunas versiones; la imagen usa
  `python:3.12-slim` para no compilar nada.
- El pipeline de CI de este repo **no está hecho a propósito**: escribirlo a mano es el
  ejercicio de la semana 1 del roadmap.
- Si no registras horas, ni el ritmo ni la racha ni los gráficos significan nada. Empieza
  marcando la sesión del día.
