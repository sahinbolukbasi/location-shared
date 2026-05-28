from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, health, locations, profile, share_codes, subscriptions
from app.core.config import get_settings
from app.db.session import engine
from app.models.models import Base

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(locations.router, prefix=settings.api_v1_prefix)
app.include_router(profile.router, prefix=settings.api_v1_prefix)
app.include_router(share_codes.router, prefix=settings.api_v1_prefix)
app.include_router(subscriptions.router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
