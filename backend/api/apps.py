from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        """
        Start the operator checker thread when the app is ready
        Only start in the main process, not in management commands or reloader
        """
        import sys
        import os

        if os.environ.get("RUN_MAIN") == "true" or "runserver" not in sys.argv:
            # Import here to avoid circular imports
            from .models import start_operator_checker_thread

            start_operator_checker_thread()
