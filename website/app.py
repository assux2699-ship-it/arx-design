"""Independent, read-mostly ARX marketing + login surface (port 8001).

No import of webpanel.py, Database, Discord Gateway, Paddle workers or tokens.
The existing customer panel continues to own Discord OAuth, sessions, billing
and webhooks on port 8000. Cutover is opt-in via reverse-proxy routing.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from arxbot.staged_marketing_languages import (
    staged_marketing_language_badges,
    staged_marketing_language_titles,
)
from arxcore.i18n import (
    COOKIE_NAME, LANGUAGE_OPTIONS, SUPPORTED_LANGUAGES, LocaleError,
    locale_context, request_locale, reset_locale, set_locale,
)

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)

PUBLIC_URL = os.getenv("ARX_PUBLIC_SITE_URL", "https://arxbot.dev").strip().rstrip("/")
PANEL_URL = os.getenv("ARX_PANEL_PUBLIC_URL", "https://panel.arxbot.dev").strip().rstrip("/")
PUBLIC_HOST = urlparse(PUBLIC_URL).hostname or "arxbot.dev"
PANEL_HOST = urlparse(PANEL_URL).hostname or "panel.arxbot.dev"
PUBLIC_HOSTS = {PUBLIC_HOST, "www." + PUBLIC_HOST}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "testclient", "testserver"}
ALLOWED_HOSTS = PUBLIC_HOSTS | {PANEL_HOST} | LOCAL_HOSTS
COOKIE_DOMAIN = os.getenv("ARX_UI_COOKIE_DOMAIN", "").strip() or (
    "." + PUBLIC_HOST if PANEL_HOST.endswith("." + PUBLIC_HOST) else ""
)
LEGAL_CONTACT = os.getenv("ARX_LEGAL_CONTACT_EMAIL", "support@arxbot.dev").strip() or "support@arxbot.dev"
# Rendering a Discord login link must not depend on copying private
# Discord OAuth secrets onto the marketing site. The customer backend on 8000
# alone validates configuration and runs the full OAuth exchange.
OAUTH_ENABLED = True
MARKETING_TITLES = staged_marketing_language_titles(SUPPORTED_LANGUAGES)
MARKETING_BADGES = staged_marketing_language_badges(SUPPORTED_LANGUAGES)

app = FastAPI(title="ARX Public Website", docs_url=None, redoc_url=None, openapi_url=None)
templates = Jinja2Templates(directory=ROOT / "templates", context_processors=[locale_context])
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


def _hostname(request: Request) -> str:
    raw = (request.headers.get("host") or "").lower().strip()
    if raw.startswith("["):
        return raw.split("]", 1)[0] + "]"
    return raw.split(":", 1)[0]


def _set_locale_cookie(response, request: Request, language: str):
    hostname = _hostname(request)
    domain = COOKIE_DOMAIN if COOKIE_DOMAIN and (hostname == PUBLIC_HOST or hostname.endswith("." + PUBLIC_HOST)) else None
    secure = (request.url.scheme == "https" or hostname in PUBLIC_HOSTS or hostname == PANEL_HOST)
    response.set_cookie(
        COOKIE_NAME, language, max_age=365 * 24 * 3600, path="/",
        httponly=True, secure=secure, samesite="lax", domain=domain,
    )
    return response


def _same_origin(request: Request) -> bool:
    """Require browser-supplied Origin to match this route's actual Host.

    Cloudflare may forward the user-facing HTTPS Host through an HTTP loopback
    connector; check against the configured public origins, never a forwarded
    origin header supplied by the client.
    """
    origin = request.headers.get("origin")
    if not origin:
        return request.headers.get("sec-fetch-site", "").lower() not in {"cross-site"}
    try:
        parsed = urlparse(origin)
        host = _hostname(request)
        if host in PUBLIC_HOSTS | {PANEL_HOST}:
            return parsed.scheme == "https" and parsed.hostname == host and parsed.port is None
        return (
            host in LOCAL_HOSTS and parsed.scheme == request.url.scheme
            and parsed.netloc.lower() == request.headers.get("host", "").lower()
        )
    except ValueError:
        return False


@app.middleware("http")
async def website_boundary(request: Request, call_next):
    path = request.url.path
    hostname = _hostname(request)
    if hostname not in ALLOWED_HOSTS:
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if hostname == "www." + PUBLIC_HOST:
        target = PUBLIC_URL + path
        if request.url.query:
            target += "?" + request.url.query
        return RedirectResponse(target, status_code=308)
    # Only the public login and interface-language endpoints belong on 8001.
    # IMPORTANT: panel.arxbot.dev/static/* always stays with the real customer
    # panel on 8000. Standalone login CSS/JS/images are served by arxbot.dev,
    # so an overly broad Cloudflare route cannot break existing panel modules.
    if hostname == PANEL_HOST and path not in {
        "/login", "/api/ui-language", "/ui-language/recover",
    }:
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if request.method not in {"GET", "HEAD", "POST"}:
        return JSONResponse({"detail": "Method Not Allowed"}, status_code=405)
    if request.method == "POST" and not _same_origin(request):
        return JSONResponse({"detail": "Cross-site request rejected"}, status_code=403)

    if path.startswith("/static/") or path == "/ui-language/recover":
        return await call_next(request)
    try:
        language = request_locale(request)
    except LocaleError:
        if path == "/api/ui-language":
            return await call_next(request)
        if path.startswith("/api/"):
            return JSONResponse(
                {"error": "unsupported_ui_locale", "languages": LANGUAGE_OPTIONS},
                status_code=400,
            )
        return RedirectResponse("/ui-language/recover", status_code=303)
    token = set_locale(language)
    try:
        response = await call_next(request)
        response.headers["Content-Language"] = language
    finally:
        reset_locale(token)
    response.headers["X-Content-Type-Options"] = "nosniff"
    if path.startswith("/static/"):
        return response
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    hostname = _hostname(request)
    if hostname == PANEL_HOST:
        raise HTTPException(status_code=404, detail="Not Found")
    language = request_locale(request)
    return templates.TemplateResponse(
        request=request, name="landing.html",
        context={
            "public_site_url": PUBLIC_URL,
            "panel_public_url": PANEL_URL,
            "marketing_languages_title": MARKETING_TITLES.get(language, ""),
            "marketing_languages_badge": MARKETING_BADGES.get(language, ""),
            "language_options": LANGUAGE_OPTIONS,
            "legal_contact": LEGAL_CONTACT,
            "paddle_js_enabled": False,  # No checkout flow on the marketing site.
            "paddle_client_token": "",
            "paddle_environment": "",
        },
    )


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, refresh: int = 0):
    if _hostname(request) in PUBLIC_HOSTS:
        suffix = "?refresh=1" if refresh else ""
        return RedirectResponse(PANEL_URL + "/login" + suffix, status_code=303)
    return templates.TemplateResponse(
        request=request, name="panel_login.html",
        context={
            "oauth_enabled": OAUTH_ENABLED,
            "public_site_url": PUBLIC_URL,
            "panel_public_url": PANEL_URL,
            # These endpoints remain on the customer-panel process (8000).
            "oauth_start_url": PANEL_URL + "/oauth/start",
            "standalone_login": True,
            "language_options": LANGUAGE_OPTIONS,
        },
    )


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy(request: Request):
    return templates.TemplateResponse(
        request=request, name="legal.html",
        context={"legal_page": "privacy", "legal_contact": LEGAL_CONTACT},
    )


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service(request: Request):
    return templates.TemplateResponse(
        request=request, name="legal.html",
        context={"legal_page": "terms", "legal_contact": LEGAL_CONTACT},
    )


@app.get("/privacy/data")
async def privacy_controls():
    return RedirectResponse(PANEL_URL + "/privacy/data", status_code=303)


@app.get("/ui-language/recover", response_class=HTMLResponse)
async def recover_language_screen():
    # Avoid locale_context() when repairing an unsupported locale cookie.
    html = templates.env.get_template("language_recovery.html").render(
        language_options=LANGUAGE_OPTIONS,
    )
    return HTMLResponse(html, headers={"Content-Language": "en", "Cache-Control": "no-store"})


@app.post("/ui-language/recover")
async def recover_language(request: Request):
    from fastapi.responses import RedirectResponse
    form = await request.form()
    language = form.get("language")
    if not isinstance(language, str) or language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="unsupported_ui_locale")
    return _set_locale_cookie(RedirectResponse("/login" if _hostname(request) == PANEL_HOST else "/", status_code=303), request, language)


@app.post("/api/ui-language")
async def save_language(request: Request):
    try:
        data = await request.json()
        language = data.get("language") if isinstance(data, dict) else None
        if not isinstance(language, str) or language not in SUPPORTED_LANGUAGES:
            raise ValueError("invalid_language")
    except (ValueError, TypeError):
        return JSONResponse(
            {"error": "unsupported_ui_locale", "languages": LANGUAGE_OPTIONS},
            status_code=400,
        )
    return _set_locale_cookie(
        JSONResponse({"ok": True, "language": language}), request, language,
    )


@app.get("/health")
async def public_health():
    # Website readiness is separate from the Discord bot and customer panel.
    return JSONResponse({"service": "arx-public-website", "status": "ok"})
