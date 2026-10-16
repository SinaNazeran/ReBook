"""Disposable real Django backend for the browser smoke suite; never uses local data."""

import importlib
import os
import signal
import socket
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest.mock import patch

BACKEND = Path(__file__).resolve().parents[1]
FRONTEND = BACKEND.parent / "frontend"
sys.path.insert(0, str(BACKEND))


def configure(directory):
    from django.conf import settings

    # Import the existing settings without loading private .env values or external Redis.
    environment = {"DJANGO_SECRET_KEY": "smoke-only-not-a-deployment-secret", "DJANGO_DEBUG": "1"}
    with patch.dict(os.environ, environment, clear=True), patch("dotenv.load_dotenv"):
        module = importlib.import_module("config.settings")
    values = {name: getattr(module, name) for name in dir(module) if name.isupper()}
    values.update(
        DATABASES={"default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(directory / "smoke.sqlite3"),
            "OPTIONS": {"transaction_mode": "IMMEDIATE", "timeout": 5},
        }},
        MEDIA_ROOT=str(directory / "media"),
        STATIC_ROOT=str(directory / "static"),
        ALLOWED_HOSTS=["127.0.0.1"],
        CORS_ALLOWED_ORIGINS=[],
        CSRF_TRUSTED_ORIGINS=[],
    )
    settings.configure(**values)
    import django

    django.setup()


def seed():
    from django.core.management import call_command

    from accounts.models import User
    from books.models import Book, Category

    call_command("migrate", verbosity=0, interactive=False)
    category = Category.objects.create(name="ادبیات آزمایشی", slug="smoke-fiction")
    seller = User.objects.create_user(username="smoke_seller", password="Rebook-smoke-only-74!")
    for project in ("desktop", "mobile"):
        for role in ("reader", "buyer"):
            User.objects.create_user(username=f"{role}_{project}", password="Rebook-smoke-only-74!")
        Book.objects.create(
            title=f"کتاب دود {project}", author="نویسنده آزمایشی", price=74000,
            seller=seller, category=category, status="approved", condition="good",
        )


def verify_orders():
    from orders.models import CartItem, Order, Transaction

    if Order.objects.filter(status="paid").count() != 2 or Order.objects.count() != 2:
        raise RuntimeError("Smoke suite did not persist exactly two paid orders.")
    if Transaction.objects.filter(status="success").count() != 2 or CartItem.objects.exists():
        raise RuntimeError("Smoke transaction/cart invariants failed.")
    print("Database verified: two paid orders, two successful transactions, empty carts.", flush=True)


def main():
    from django.core.servers.basehttp import ThreadedWSGIServer, WSGIRequestHandler

    child = None

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    with TemporaryDirectory(prefix="rebook-smoke-") as temporary:
        configure(Path(temporary))
        seed()
        from django.core.handlers.wsgi import WSGIHandler

        server = ThreadedWSGIServer(("127.0.0.1", 0), WSGIRequestHandler, allow_reuse_address=False)
        server.set_app(WSGIHandler())
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            frontend_port = reservation.getsockname()[1]
        from django.conf import settings

        origin = f"http://127.0.0.1:{frontend_port}"
        settings.CORS_ALLOWED_ORIGINS = [origin]
        settings.CSRF_TRUSTED_ORIGINS = [origin]
        print(f"Smoke servers: API=http://127.0.0.1:{server.server_port}/api frontend={origin}", flush=True)
        print(f"Smoke temporary storage: {temporary}", flush=True)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        environment = {**os.environ, "REBOOK_SMOKE_API_URL": f"http://127.0.0.1:{server.server_port}/api",
                       "REBOOK_SMOKE_PORT": str(frontend_port)}
        try:
            child = subprocess.Popen([sys.argv[1], "e2e/browser-runner.mjs"], cwd=FRONTEND, env=environment)
            result = child.wait()
            if result == 0:
                verify_orders()
            return result
        finally:
            if child and child.poll() is None:
                # The runner receives the same console interrupt and closes Vite/browser workers.
                try:
                    child.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    child.terminate()
                    child.wait(timeout=10)
            server.shutdown()
            worker.join(timeout=10)
            server.server_close()
            from django.db import connections

            connections.close_all()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
