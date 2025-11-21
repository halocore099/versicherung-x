import os
import pathlib
import json
import dotenv
from fastapi import FastAPI, APIRouter, Depends

dotenv.load_dotenv()

from databutton_app.mw.auth_mw import AuthConfig, get_authorized_user


def get_router_config() -> dict:
    try:
        # Note: This file is not available to the agent
        cfg = json.loads(open("routers.json").read())
    except:
        return False
    return cfg


def is_auth_disabled(router_config: dict, name: str) -> bool:
    return router_config["routers"][name]["disableAuth"]


def import_api_routers() -> APIRouter:
    """Create top level router including all user defined endpoints."""
    routes = APIRouter(prefix="/routes")

    router_config = get_router_config()

    src_path = pathlib.Path(__file__).parent

    # Import API routers from "src/app/apis/*/__init__.py"
    apis_path = src_path / "app" / "apis"

    api_names = [
        p.relative_to(apis_path).parent.as_posix()
        for p in apis_path.glob("*/__init__.py")
    ]

    api_module_prefix = "app.apis."

    for name in api_names:
        print(f"Importing API: {name}")
        try:
            api_module = __import__(api_module_prefix + name, fromlist=[name])
            api_router = getattr(api_module, "router", None)
            if isinstance(api_router, APIRouter):
                routes.include_router(
                    api_router,
                    dependencies=(
                        []
                        if is_auth_disabled(router_config, name)
                        else [Depends(get_authorized_user)]
                    ),
                )
        except Exception as e:
            print(e)
            continue

    print(routes.routes)

    return routes


def get_firebase_config() -> dict | None:
    """Get Firebase config from environment variable."""
    firebase_config_json = os.environ.get("FIREBASE_CONFIG")
    if firebase_config_json:
        try:
            return json.loads(firebase_config_json)
        except json.JSONDecodeError:
            print("Error: FIREBASE_CONFIG is not valid JSON")
            return None
    return None


def create_app() -> FastAPI:
    """Create the app. This is called by uvicorn with the factory option to construct the app object."""
    app = FastAPI()
    app.include_router(import_api_routers())

    for route in app.routes:
        if hasattr(route, "methods"):
            for method in route.methods:
                print(f"{method} {route.path}")

    firebase_config = get_firebase_config()

    if firebase_config is None:
        print("No firebase config found - authentication will be disabled")
        app.state.auth_config = None
    else:
        print("Firebase config found")
        # Extract projectId from Firebase config
        project_id = firebase_config.get("projectId")
        if not project_id:
            print("Warning: Firebase config missing projectId")
            app.state.auth_config = None
        else:
            auth_config = {
                "jwks_url": "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
                "audience": project_id,
                "header": "authorization",
            }
            app.state.auth_config = AuthConfig(**auth_config)

    return app


app = create_app()
