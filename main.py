from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

from backend.algorithm import RouteOptimizer
from backend.flight_routes import router as flight_router
from backend.iata_lookup import iata_lookup  
from backend.final_city import router as city_router

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Data Models ---
class CityInput(BaseModel):
    name: str
    days: int

class TripRequest(BaseModel):
    start_city: str
    end_city: str
    middle_cities: List[CityInput]
    total_days: int
    start_date: str
    end_date: str
    adults: int = 1
    children: int = 0
    infants: int = 0

app.include_router(flight_router)
app.include_router(city_router)

@app.post("/optimize")
async def optimize_route(trip: TripRequest):
    try:
        logger.info(f" Received trip request: {trip}")
        middle_cities_dict = [{"name": city.name, "days": city.days} for city in trip.middle_cities]
        optimizer = RouteOptimizer(adults=trip.adults, children=trip.children, infants=trip.infants)
        optimal_routes = optimizer.find_optimal_routes(
            start_city=trip.start_city,
            end_city=trip.end_city,
            middle_cities=middle_cities_dict,
            start_date=trip.start_date,
            end_date=trip.end_date,
            num_results=3
        )
        if not optimal_routes:
            return {"status": "success", "message": "No routes found", "routes": []}
        return {"status": "success", "count": len(optimal_routes), "routes": optimal_routes}
    except Exception as e:
        logger.error(f"Error optimizing route: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Travel Route Optimizer"}

@app.get("/iata")
async def get_iata(city: str, strategy: str = "largest"):
    """Get IATA code for a city"""
    iata = iata_lookup.get_iata_for_city(city, strategy=strategy)
    if not iata:
        raise HTTPException(status_code=404, detail=f"No IATA code found for city: {city}")
    return {"city": city.title(), "iata": iata}

@app.get("/airports")
async def get_airports(city: str):
    """Get all airports for a city"""
    airports = iata_lookup.get_airports_by_city(city)
    if not airports:
        raise HTTPException(status_code=404, detail=f"No airports found for city: {city}")
    return {"city": city.title(), "airports": airports}

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

