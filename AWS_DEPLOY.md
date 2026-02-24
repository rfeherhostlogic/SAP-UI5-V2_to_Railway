# AWS Deploy (Docker)

Ez a repo most Docker alapon deployolhato AWS-re a repo gyokerbol, akkor is, ha az app a `myChatbot/` mappaban van.

## Tamogatott AWS celok

- AWS App Runner (ajanlott, egyszerubb)
- Amazon ECS (Fargate)
- AWS Elastic Beanstalk (Docker platform)

## Elokeszites

1. Buildeld lokalban (opcionalis ellenorzes):
   - `docker build -t mychatbot-app .`
2. Futtasd lokalban:
   - `docker run --rm -p 3000:3000 --env-file myChatbot/.env mychatbot-app`
3. Nyisd meg:
   - `http://localhost:3000`

## Szükseges kornyezeti valtozok AWS-ben

- `OPENAI_API_KEY`
- `APP_SESSION_SECRET`
- `APP_USERS_JSON`

Peldakent az `APP_USERS_JSON` egy sorban:

```json
[{"username":"HelloAdam","displayName":"HelloAdam","passwordHash":"$2b$12$qOxR2DTh0RPShwaMLiFHw.AdGnUw.DW6gbeD21ntH0yjM3ibt9DN2"},{"username":"HelloLaci","displayName":"HelloLaci","passwordHash":"$2b$12$SxPtaGr/RrR9RAVfiHIxd.JwxA0XXcWfjQZOjfoSnEoAcM2a7kGt6"},{"username":"HelloRoli","displayName":"HelloRoli","passwordHash":"$2b$12$X0Cf18ZVzbRi374ormtxWeE/RLFoyQFZv2B.pZzaGGoJ4VPlI5V7y"}]
```

## AWS App Runner (ajanlott)

1. AWS Console -> App Runner -> `Create service`
2. Source:
   - `Source code repository` (GitHub) vagy `Container registry (ECR)`
3. Ha GitHub source:
   - Build type: `Dockerfile`
   - Root: repo gyoker (a `Dockerfile` mar ott van)
4. Port:
   - `3000` (a kontener ezt expose-olja; AWS a sajat port mappinget intezi)
5. Health check path:
   - `/api/health`
6. Add environment variables (fenti 3 db)
7. Deploy

## Amazon ECS (Fargate) roviden

1. Build image
2. Push ECR-be
3. ECS Task Definition:
   - Container port: `3000`
   - Health check path az ALB target groupban: `/api/health`
4. Add env vars a taskhoz
5. Service inditas Fargate-on

## Megjegyzesek

- A session tarolas jelenleg memoriaban tortenik (ujrainditasnal kijelentkeztet).
- Ha skálázni akarod tobb peldanyra, session store (pl. Redis / ElastiCache) javasolt.
