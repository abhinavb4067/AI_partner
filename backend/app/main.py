from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from app.api.routes import chat, auth  # Added auth here
from app.core.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maya AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include both route files
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])

# Mount media directory to serve images
if not os.path.exists("media"):
    os.makedirs("media")
app.mount("/media", StaticFiles(directory="media"), name="media")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)