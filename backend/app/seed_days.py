"""Daily study plan: what to do, on which day, and exactly where to stop.

Shape of every week (offsets from the week start):
    d0  45 min · d1  60 min · d2  45 min · d4  60 min · d5 120 min · d6  30 min (review)
    = 6 h exactas, con d3 libre.

La semana 1 es la excepcion: empieza el viernes 21 en vez del jueves 20, asi que
reparte las mismas 6 h en cuatro sesiones (45/90/75/120) + review.

Content is specific on purpose. "Estudiar RAG" is not a session; "Módulo 2, primera
mitad, hasta terminar BM25" is. Deliberate practice needs a target you can finish.

Verificado en agosto de 2026:
  - Orden real de los learning exercises del track de Python en Exercism.
  - LangChain Essentials tiene 9 lecciones numeradas (1 h de vídeo).
  - Numeros de leccion reales de Software Architecture Monday (Mark Richards).
"""

from __future__ import annotations

# (offset, minutes, mode, title, scope, task_title, resource_name)
Session = tuple[int, int, str, str, str, str, str]

R_EXERCISM = "Exercism — Python Track"
R_LC = "Quickstart: LangChain Essentials — Python"
R_LG_Q = "Quickstart: LangGraph Essentials — Python"
R_LG_F = "Foundation: Introduction to LangGraph — Python"
R_RAG = "Retrieval Augmented Generation (RAG)"
R_RICHARDS = "Software Architecture Monday"
R_PRIMER = "System Design Primer"
R_FASTAPI = "FastAPI — Documentacion oficial"
R_GHA = "GitHub Actions — Documentacion oficial"
R_MSLEARN = "Microsoft Learn — Azure training"
R_AI200 = "AI-200 Study Guide"
R_LANGSMITH = "Quickstart: LangSmith Essentials"
R_KARPATHY = "Neural Networks: Zero to Hero"
R_ILLUSTRATED = "The Illustrated Transformer"
R_PYTORCH = "PyTorch — Learn the Basics"
R_HF = "Hugging Face — LLM Course"

REVIEW = "Weekly Review"

WEEK_PLANS: dict[int, list[Session]] = {
    1: [
        # La semana arranca el viernes 21: el jueves 20 no hubo sesion.
        # Hoy toca CI/CD porque esta tarde el despliegue se hace de verdad en el Mac Mini.
        (1, 45, "Mixed", "CI/CD · tu primer workflow de GitHub Actions",
         "Lee Understanding GitHub Actions y escribe a mano .github/workflows/ci.yml en un repo tuyo: un job con checkout, setup-python y `ruff check`. Empuja y para cuando el check salga verde. Por la tarde, el despliegue en el servidor: `docker compose up -d --build`, comprobar el healthcheck y anotar lo que se rompio.",
         "Pipeline CI real: push → lint → pytest → docker build", R_GHA),
        (2, 90, "Mixed", "LangChain Essentials · lecciones 1–5 y 7",
         "Create Agent, Models and Messages, Streaming, Tools y Structured Output. Teclea el agente minimo y sus tools a mano; no clones el repo del curso. Salta Memory y Dynamic Prompt: entran en la semana 3.",
         "LangChain Essentials — models, messages, prompts, structured output", R_LC),
        (4, 75, "Practice", "Exercism · los tres primeros del track",
         "Guido's Gorgeous Lasagna, Ghost Gobble y Currency Exchange. Sin IA hasta que `exercism test` pase en verde; despues pide code review.",
         "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (5, 120, "Practice", "Lab V0 + pipeline CI en verde",
         "Crea el repo ai-engineering-lab con un agente y 2 tools propias. Amplia el workflow del viernes con pytest y docker build. Termina cuando los tres jobs esten verdes en GitHub.",
         "Pipeline CI real: push → lint → pytest → docker build", R_GHA),
    ],
    2: [
        (0, 45, "Practice", "Exercism · Meltdown Mitigation",
         "Conditionals. Sin IA.", "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Theory", "Fundamentos del embedding: geometría y normalización",
         "Vector denso, dimensiones, magnitud y producto escalar. Deriva la similitud angular a mano, compárala con distancia euclídea y explica por qué la normalización cambia la geometría del ranking.",
         "Fundamentos de embeddings: vectores, geometría y normalización", ""),
        (2, 45, "Mixed", "Chunking: la tabla de trade-offs",
         "Fixed vs recursive vs semantic vs document-aware. Escribe tu tabla con el efecto de size y overlap sobre recall y ruido. Una página.",
         "Chunking: por que existe y trade-offs de cada estrategia", ""),
        (4, 60, "Practice", "Embedding lab: ranking Top-K desde cero",
         "10 textos → embeddings → implementa la métrica angular en numpy puro (sin librerías de similitud) → ranking Top-K. Repite con vectores normalizados y anota qué cambia.",
         "Embedding lab: ranking Top-K desde cero", ""),
        (5, 120, "Practice", "Embedding lab: validar el ranking con pgvector",
         "Reproduce el mismo ranking con pgvector. Compara métrica, resultados y tiempos; explica cuándo la distancia euclídea coincide con la angular y cuándo no. Este es el entregable que cierra la skill de embeddings.",
         "Embedding lab: ranking Top-K desde cero", ""),
    ],
    3: [
        (0, 45, "Practice", "Exercism · Black Jack",
         "Comparisons. Sin IA.", "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Mixed", "RAG DeepLearning.AI · Módulo 2, primera mitad",
         "Keyword search y BM25. Para cuando puedas explicar por qué BM25 sigue vivo en 2026. SALTA el módulo 1 entero.",
         "RAG DeepLearning.AI — Modulo 2: keyword, semantic e hybrid search", R_RAG),
        (2, 45, "Mixed", "RAG · Módulo 2, segunda mitad",
         "Semantic search e hybrid search. Objetivo: explicar en qué falla cada uno por separado.",
         "RAG DeepLearning.AI — Modulo 2: keyword, semantic e hybrid search", R_RAG),
        (4, 60, "Mixed", "RAG · Módulo 3 completo",
         "Vector DBs, kNN vs ANN, HNSW por capas y reranking. Dibuja HNSW: si no lo sabes dibujar, no lo sabes.",
         "RAG DeepLearning.AI — Modulo 3: vector DBs, indexes y reranking", R_RAG),
        (5, 120, "Practice", "Hybrid search + RRF + reranker en el Lab",
         "Full-text de Postgres + búsqueda vectorial fusionados con Reciprocal Rank Fusion, y un cross-encoder encima. Mide el antes y el después con 5 consultas fijas.",
         "Hybrid search + RRF + reranker en el Lab", ""),
    ],
    4: [
        (0, 45, "Practice", "Exercism · Little Sister's Essay",
         "String methods. Sin IA.", "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Theory", "Richards · lecciones 161 y 159",
         "Agility and Monolithic Architectures (161) y Modular Monolith Architecture (159). Son vídeos cortos: ve los dos y toma notas propias.",
         "Estilos arquitectonicos: monolith, modular monolith, microservices", R_RICHARDS),
        (2, 45, "Theory", "Richards · lección 162 + tu tabla",
         "Microservices Architecture (162). Cierra con tu tabla: cuándo cada estilo y qué duele en cada uno.",
         "Estilos arquitectonicos: monolith, modular monolith, microservices", R_RICHARDS),
        (4, 60, "Theory", "Richards · lección 131 + los 4 estilos restantes",
         "Microservices vs Event-Driven Architecture (131). Después dibuja layered, clean, hexagonal y event-driven, una frase por cada una diciendo qué problema resuelve.",
         "Layered, clean, hexagonal y event-driven architecture", R_RICHARDS),
        (5, 120, "Practice", "ADR del Lab: decide y defiéndelo",
         "Una página: problema, opciones, decisión, ventajas, inconvenientes, trade-offs. Lo escribes tú entero. Solo después se lo das a la IA para que lo critique.",
         "ADR: decidir y justificar la arquitectura del Lab", ""),
    ],
    5: [
        (0, 45, "Practice", "Exercism · Little Sister's Vocabulary",
         "Strings. Sin IA.", "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Theory", "SOLID sobre TU código",
         "Un ejemplo real de tu propio código por cada principio. Si no encuentras el ejemplo, es que no lo entiendes todavía.",
         "SOLID, coupling, cohesion e inversion de dependencias", R_RICHARDS),
        (2, 60, "Practice", "Lab V1 · estructura en capas",
         "Crea api/ domain/ services/ repositories/ infrastructure/ agents/ y mueve el V0 dentro. Routers y schemas Pydantic.",
         "AI Engineering Lab V1 — FastAPI en capas", R_FASTAPI),
        (4, 45, "Practice", "FastAPI docs · Dependencies y Bigger Applications",
         "Lee esas dos secciones y aplica inyección de dependencias al Lab. Nada de main.py de 800 líneas.",
         "AI Engineering Lab V1 — FastAPI en capas", R_FASTAPI),
        (5, 120, "Practice", "Middleware, excepciones y tests",
         "FastAPI docs: Middleware, Handling Errors y Testing. Deja fixtures, un mock del LLM y un test de integración corriendo en el CI de la semana 1.",
         "Tests del Lab con pytest", R_FASTAPI),
    ],
    6: [
        (0, 45, "Practice", "Exercism · Card Games",
         "Lists. Sin IA.", "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Practice", "Auth: JWT + RBAC en el Lab",
         "Endpoints protegidos con roles. Termina explicando en voz alta la diferencia entre autenticación y autorización.",
         "Auth en el Lab: JWT, OAuth y RBAC", ""),
        (2, 45, "Practice", "Redis como cache",
         "Cachea la parte cara del retrieval. Mide el hit rate y la latencia antes y después.",
         "AI Engineering Lab V2 — Redis, worker, cola y caching", ""),
        (4, 60, "Practice", "Cola + worker con retries",
         "Background job con exponential backoff y jitter. Provoca un fallo a propósito y observa los reintentos.",
         "AI Engineering Lab V2 — Redis, worker, cola y caching", ""),
        (5, 120, "Practice", "Idempotency, rate limiting y cierre del V2",
         "Idempotency key en el endpoint de escritura, rate limiting, y repaso de índices y FKs del esquema. Manda la misma petición dos veces y comprueba que solo se ejecuta una.",
         "AI Engineering Lab V2 — Redis, worker, cola y caching", ""),
    ],
    7: [
        (0, 45, "Practice", "Exercism · Chaitana's Colossal Coaster",
         "List methods. Vuelta a la rutina después del viaje, empieza suave.",
         "Exercism Python — 5 ejercicios sin IA", R_EXERCISM),
        (1, 60, "Mixed", "LangGraph Essentials · state, nodes, edges",
         "Dibuja el grafo en papel ANTES de escribir una línea de código.",
         "LangGraph Essentials: state, nodes, edges, conditional edges", R_LG_Q),
        (2, 45, "Mixed", "LangGraph Essentials · conditional edges y memory",
         "Termina el workflow de email del curso.",
         "LangGraph Essentials: state, nodes, edges, conditional edges", R_LG_Q),
        (4, 60, "Mixed", "Intro to LangGraph · persistence y checkpoints",
         "La parte que de verdad se pregunta en entrevista. Objetivo: explicar durable execution.",
         "LangGraph avanzado: persistence, checkpoints, interrupts, HITL", R_LG_F),
        (5, 120, "Practice", "Agente stateful real en el Lab",
         "Estado persistido, un interrupt con aprobación humana y retries. Mata el proceso a media ejecución y comprueba que retoma donde estaba.",
         "Agente stateful real en el Lab con LangGraph", ""),
    ],
    8: [
        (0, 45, "Theory", "Primer · escalado y load balancing",
         "Vertical vs horizontal y balanceo. Consulta por tema, NO leas el repo entero.",
         "Fundamentos de escala: vertical, horizontal, load balancing, caching", R_PRIMER),
        (1, 60, "Theory", "Primer · caching, colas y pub/sub",
         "Cierra con roadmap.sh como checklist para detectar qué te falta.",
         "Fundamentos de escala: vertical, horizontal, load balancing, caching", R_PRIMER),
        (2, 45, "Theory", "Primer · replication, sharding, CAP",
         "Consistencia eventual y failure modes, con ejemplos de tu propio Lab.",
         "Distributed systems: replication, sharding, CAP, eventual consistency", R_PRIMER),
        (4, 60, "Practice", "Diseña 2 sistemas: AI chat y RAG empresarial",
         "En papel y TÚ primero. Cuando estén, la IA hace de entrevistador y tú defiendes.",
         "System design x3: AI chat, RAG empresarial, document processing", ""),
        (5, 120, "Practice", "Diseña los 3 restantes y defiéndelos",
         "Document processing, notifications y agent system. Con esto se cumple el criterio de completion de System Design: 5 sistemas diseñados y defendidos.",
         "System design x2: notifications y agent system", ""),
    ],
    9: [
        (0, 45, "Theory", "Temario AI-200 como mapa de huecos",
         "Marca qué dominios ya cubre tu Lab y cuáles no. El examen es opcional; el temario no.",
         "Leer el temario oficial de AI-200 como mapa de huecos", R_AI200),
        (1, 60, "Practice", "Dockerfile multi-stage desde cero",
         "Sin copiar. Al terminar explica cada capa, el orden por cache y el healthcheck, y mide el tamaño final.",
         "Dockerfile multi-stage del Lab escrito desde cero", ""),
        (2, 45, "Practice", "Azure Container Registry",
         "Crea el ACR y sube la imagen del Lab.",
         "AI Engineering Lab V4 — desplegar en Azure Container Apps", R_MSLEARN),
        (4, 60, "Practice", "Azure Container Apps · entorno y variables",
         "Crea el Container App y configura las variables de entorno.",
         "AI Engineering Lab V4 — desplegar en Azure Container Apps", R_MSLEARN),
        (5, 120, "Practice", "Lab V4 respondiendo en una URL pública",
         "No has terminado hasta que abras la URL desde el móvil y responda.",
         "AI Engineering Lab V4 — desplegar en Azure Container Apps", R_MSLEARN),
    ],
    10: [
        (0, 45, "Practice", "Job de deploy en GitHub Actions",
         "Que el pipeline llegue hasta el despliegue.",
         "AI Engineering Lab V3 — CD completo con healthcheck", R_GHA),
        (1, 60, "Practice", "Healthcheck post-deploy y rollback",
         "Rompe el deploy a propósito y comprueba que revierte. Con esto se cierra el criterio de CI/CD.",
         "AI Engineering Lab V3 — CD completo con healthcheck", R_GHA),
        (2, 45, "Practice", "Key Vault + Managed Identity",
         "Cero secretos en el repo. Explica por qué Managed Identity gana a una connection string.",
         "Key Vault, Managed Identity y App Configuration", R_MSLEARN),
        (4, 60, "Practice", "Service Bus con dead-letter queue",
         "Cola + Function con trigger. Manda un mensaje duplicado y observa qué pasa.",
         "Service Bus + Functions: mover el worker a mensajeria Azure", R_MSLEARN),
        (5, 120, "Practice", "OpenTelemetry + Application Insights",
         "Instrumenta el Lab, consigue ver una traza distribuida completa y escribe una query KQL propia.",
         "Application Insights + OpenTelemetry en el Lab desplegado", R_MSLEARN),
    ],
    11: [
        (0, 45, "Mixed", "LangSmith · tracing del agente",
         "Cada llamada trazada, con coste y tokens visibles.",
         "LangSmith: tracing y prompt versioning", R_LANGSMITH),
        (1, 60, "Practice", "Dataset de evaluación propio",
         "20–30 casos reales con su respuesta esperada. Sin dataset no hay evals, solo opiniones.",
         "Eval dataset + retrieval evaluation + LLM-as-judge", R_RAG),
        (2, 45, "Practice", "Métricas de retrieval + LLM-as-judge",
         "Mide el retrieval y monta el judge. Objetivo: poder decir con números si un cambio mejora.",
         "Eval dataset + retrieval evaluation + LLM-as-judge", ""),
        (4, 60, "Practice", "Guardrails, fallback y alucinaciones",
         "Guardrail de entrada, fallback de modelo y detección de alucinaciones. Cierra el Lab V6.",
         "Guardrails, fallbacks y deteccion de alucinaciones", ""),
        (5, 120, "Practice", "V5 · Modular Monolith vs Microservice, medido",
         "Separa un componente del Lab, mide latencia y complejidad reales, y escribe el documento de trade-offs. Ese documento es tu respuesta de arquitectura en entrevista.",
         "V5 — Comparativa Modular Monolith vs Microservice documentada", ""),
    ],
    12: [
        (0, 45, "Practice", "Exercism · cierra hasta 40",
         "Los que te falten para llegar al mínimo del criterio de completion de Python.",
         "Exercism Python — cerrar los 40-60 ejercicios", R_EXERCISM),
        (1, 60, "Theory", "Auditoría honesta de las 30 skills",
         "Cada skill contra su Completion Criteria. Si no hay evidencia que enseñar, el nivel BAJA. Es el punto del sprint entero.",
         "Auditoria de skills: subir o BAJAR niveles con honestidad", ""),
        (2, 60, "Practice", "Entrevista simulada 1",
         "Python + RAG + agentes. La IA en modo entrevistador hostil. Marca Can Explain / Can Implement según lo que pase de verdad, no según lo que creas saber.",
         "Entrevista simulada 1: Python + RAG + agentes", ""),
        (4, 60, "Practice", "Entrevista simulada 2",
         "Arquitectura, backend, system design y cloud. Mismo protocolo.",
         "Entrevista simulada 2: arquitectura, backend, system design y cloud", ""),
        (5, 90, "Theory", "Plan de diciembre a partir de los fallos",
         "Repasa las preguntas falladas en las dos simulaciones. Eso, y no otra cosa, es el plan de diciembre.",
         "Weekly Review S12 — cierre del sprint", ""),
    ],
    13: [
        (0, 45, "Theory", "ML fundamentals · supervised vs unsupervised",
         "Qué es aprender de datos, train/validation/test y por qué separar los tres. Para cuando puedas explicar qué pasa si validas con el test.",
         "ML fundamentals: supervised, loss, gradient descent, overfitting, F1", ""),
        (1, 60, "Theory", "Loss y gradient descent",
         "Función de pérdida, gradiente y learning rate. Dibuja la curva de descenso a mano.",
         "ML fundamentals: supervised, loss, gradient descent, overfitting, F1", ""),
        (2, 45, "Theory", "Overfitting, precision, recall y F1",
         "Cuándo importa recall y cuándo precision, con un ejemplo de tu propio RAG. Cierra la skill de ML fundamentals.",
         "ML fundamentals: supervised, loss, gradient descent, overfitting, F1", ""),
        (4, 60, "Practice", "Karpathy micrograd · el objeto Value",
         "Primera mitad del vídeo. Implementa Value con suma y multiplicación y su grafo de operaciones. Teclea, no copies.",
         "Karpathy micrograd: backpropagation escrita a mano", R_KARPATHY),
        (5, 120, "Practice", "Karpathy micrograd · backward y una red mínima",
         "Implementa backward, monta un MLP pequeño y entrénalo. Al terminar deberías poder explicar backpropagation sin mirar.",
         "Karpathy micrograd: backpropagation escrita a mano", R_KARPATHY),
    ],
    14: [
        (0, 45, "Theory", "Illustrated Transformer · tokenización y posición",
         "Primera parte del artículo: tokens, embeddings y por qué hace falta información posicional.",
         "The Illustrated Transformer: modelo mental de attention", R_ILLUSTRATED),
        (1, 60, "Theory", "Illustrated Transformer · Q, K, V",
         "Self-attention paso a paso. Termina dibujando Q/K/V de memoria en un folio.",
         "The Illustrated Transformer: modelo mental de attention", R_ILLUSTRATED),
        (2, 45, "Theory", "Multi-head attention y el bloque completo",
         "Por qué varias cabezas y no una. Feed-forward, residuales y norm. Dibuja el bloque entero.",
         "The Illustrated Transformer: modelo mental de attention", R_ILLUSTRATED),
        (4, 60, "Practice", "GPT desde cero · tokenizador y datos",
         "Empieza el nanoGPT de Karpathy: tokenizador a nivel de carácter y los batches de entrenamiento.",
         "Karpathy: construir un GPT pequeno desde cero", R_KARPATHY),
        (5, 120, "Practice", "GPT desde cero · self-attention en código",
         "Implementa una cabeza de atención y luego multi-head. Es la sesión más difícil del mes: reserva la cabeza fresca.",
         "Karpathy: construir un GPT pequeno desde cero", R_KARPATHY),
    ],
    15: [
        (0, 45, "Practice", "PyTorch · tensors y autograd",
         "Learn the Basics, dos primeras secciones. Juega con requires_grad y mira los gradientes.",
         "PyTorch Learn the Basics: tensors, autograd, training loop", R_PYTORCH),
        (1, 60, "Practice", "PyTorch · modelo, loss y optimizer",
         "Define un nn.Module, elige loss y optimizer, y escribe el training loop entero a mano.",
         "PyTorch Learn the Basics: tensors, autograd, training loop", R_PYTORCH),
        (2, 45, "Mixed", "Inference · logits, softmax y temperature",
         "Cambia la temperature en Ollama y observa el efecto real en la salida. Explica qué le hace a la distribución.",
         "Inference: logits, softmax, temperature, Top-K, Top-P, KV cache", ""),
        (4, 60, "Mixed", "Top-K vs Top-P y KV cache",
         "Prueba ambos en Ollama. Mide la latencia del primer token frente a los siguientes y explica por qué difieren.",
         "Inference: logits, softmax, temperature, Top-K, Top-P, KV cache", ""),
        (5, 120, "Practice", "GPT desde cero · bloque transformer y generación",
         "Completa el modelo, entrénalo y genera texto. Este entregable cierra la skill de Transformers.",
         "Karpathy: construir un GPT pequeno desde cero", R_KARPATHY),
    ],
    16: [
        (0, 45, "Practice", "Hugging Face · pipelines",
         "Primer capítulo del curso. Ejecuta 3 pipelines distintos en local.",
         "Hugging Face: transformers, tokenizers, pipelines, datasets", R_HF),
        (1, 60, "Practice", "Hugging Face · tokenizers y el hub",
         "Carga un modelo del hub por su id y compara su tokenizador con el que escribiste tú en nanoGPT.",
         "Hugging Face: transformers, tokenizers, pipelines, datasets", R_HF),
        (2, 45, "Mixed", "RAG vs fine-tuning · escribe la respuesta",
         "Coste, datos necesarios, frescura y control. Escribe tu respuesta de entrevista en 5 líneas y guárdala en las notas de la pregunta.",
         "RAG vs fine-tuning, LoRA, QLoRA y PEFT", R_HF),
        (4, 60, "Mixed", "LoRA, QLoRA y PEFT",
         "Por qué LoRA es tan barato. Quédate con el orden de magnitud de parámetros entrenables frente al fine-tuning completo.",
         "RAG vs fine-tuning, LoRA, QLoRA y PEFT", R_HF),
        (5, 120, "Practice", "Quantization y VRAM de tus modelos",
         "FP32/FP16/BF16/INT8/INT4. Calcula a mano la VRAM de un 7B en cada formato y contrástalo con lo que ocupan de verdad en tu Mac Mini. Cierra con Ollama vs vLLM.",
         "Quantization y VRAM aplicado a mis modelos de Ollama", ""),
    ],
}

# Cada semana cierra con la review el último día.
REVIEW_SESSION = (6, 30, "Theory", "Weekly Review",
                  "Horas reales, qué construiste, qué NO puedes explicar todavía, y el objetivo de la semana que viene. 30 minutos, sin excusas.")
