from fastapi import APIRouter, HTTPException
from backend.iata_lookup import iata_lookup

router = APIRouter()

@router.get("/api/airport-lookup/{city_name}")
async def airport_lookup(city_name: str):
    """Look up IATA code for a city using local dataset"""
    try:
        iata_code = iata_lookup.get_iata_for_city(city_name, strategy="largest")
        
        if iata_code:
            airport_info = iata_lookup.get_airport_by_iata(iata_code)
            return {
                "iata_code": iata_code,
                "city_name": airport_info['city'],
                "country": airport_info['country'],
                "airport_name": airport_info['name']
            }
        else:
            raise HTTPException(status_code=404, detail=f"No airports found for city: {city_name}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error looking up IATA code: {str(e)}")

@router.get("/api/city-suggestions")
async def get_city_suggestions(query: str):
    """Get city suggestions using local dataset"""
    try:
        if len(query) < 2:
            return {"suggestions": []}
        
        suggestions = iata_lookup.search_cities(query, limit=5)
        return {"suggestions": suggestions}
        
    except Exception as e:
        print(f"Error fetching city suggestions: {e}")
        return {"suggestions": []}