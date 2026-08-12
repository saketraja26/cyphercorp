import urllib.parse
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


def get_clean_database_url_and_args(raw_url: str):
    """
    Cleans PostgreSQL connection strings (Neon.tech, Render, Supabase) for asyncpg.
    Removes unsupported query parameters like sslmode and channel_binding,
    and applies SSL connect_args.
    """
    connect_args = {}
    url = raw_url.strip()

    if url.startswith("sqlite://"):
        if not url.startswith("sqlite+aiosqlite://"):
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url, connect_args

    # Check for PostgreSQL schemes
    is_postgres = (
        url.startswith("postgres://")
        or url.startswith("postgresql://")
        or url.startswith("postgresql+asyncpg://")
    )

    if is_postgres:
        parsed = urllib.parse.urlparse(url)
        query_dict = urllib.parse.parse_qs(parsed.query)

        # asyncpg does not accept sslmode or channel_binding in URL query parameters
        sslmode = query_dict.pop("sslmode", [None])[0]
        query_dict.pop("channel_binding", None)

        if sslmode in ("require", "verify-ca", "verify-full", "prefer") or "neon.tech" in parsed.netloc or "supabase" in parsed.netloc:
            connect_args["ssl"] = True

        new_query = urllib.parse.urlencode(query_dict, doseq=True)
        scheme = "postgresql+asyncpg"

        clean_url = urllib.parse.urlunparse((
            scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        ))
        return clean_url, connect_args

    return url, connect_args


clean_db_url, db_connect_args = get_clean_database_url_and_args(settings.database_url)

engine = create_async_engine(
    clean_db_url,
    connect_args=db_connect_args,
    echo=False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


class Base(DeclarativeBase):
    pass