# server/__main__.py
import uvicorn
from server.settings import settings

if __name__ == "__main__":
    uvicorn.run(
        "server.main:app",
        host=settings.bind_host,
        port=settings.bind_port,
        reload=True,
    )
